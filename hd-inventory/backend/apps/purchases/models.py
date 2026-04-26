"""
purchases/models.py — Órdenes de Compra (Purchase Orders)

Flujo de estados:
  En Proceso → PO Aprobada → Recibido
                           ↘ Cancelado

Al cambiar a 'recibido':
  - Busca el material por FK o por no_parte (code).
  - Si existe: suma cantidad al stock_actual y crea una Entrada de trazabilidad.
  - Si NO existe: crea el material en estado INACTIVO y establece stock_actual = cantidad.
    La instancia guarda self._material_creado_inactivo = True para que el ViewSet
    pueda incluir una advertencia en la respuesta.
"""
from django.db import models
from django.conf import settings
from django.utils import timezone


class OrdenCompra(models.Model):

    STATUS_CHOICES = [
        ('en_proceso',   'En Proceso'),
        ('ordenado',     'Ordenado'),
        ('pr_aprobada',  'PR aprobada'),
        ('po_aprobada',  'PO aprobada'),
        ('rem_recibido', 'REM recibida'),
        ('recibido',     'Recibido'),
        ('cancelado',    'Cancelado'),
    ]

    MONEDA_CHOICES = [
        ('MXN', 'Pesos MXN'),
        ('USD', 'Dólares USD'),
    ]

    # ─── Identificación del ítem ──────────────────────────────
    fecha_emision   = models.DateField(
        verbose_name='Fecha Emisión OC',
        default=timezone.localdate,
    )
    material        = models.ForeignKey(
        'materials.Material',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ordenes_compra',
        verbose_name='Material (vinculado)',
        help_text='Se enlaza automáticamente si el No. parte existe en inventario.',
    )
    no_parte        = models.CharField(max_length=100, verbose_name='No. Parte')
    descripcion     = models.CharField(max_length=300, verbose_name='Descripción')
    cantidad        = models.PositiveIntegerField(verbose_name='Cantidad')

    # ─── Costos ──────────────────────────────────────────────
    costo_unitario  = models.DecimalField(
        max_digits=12, decimal_places=4,
        verbose_name='Costo por Unidad',
    )
    moneda          = models.CharField(
        max_length=3,
        choices=MONEDA_CHOICES,
        default='MXN',
        verbose_name='Moneda',
    )

    # ─── Estado / PO ─────────────────────────────────────────
    status          = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='ordenado',
        db_index=True,
        verbose_name='Estado',
    )
    po_number       = models.CharField(
        max_length=100, blank=True,
        verbose_name='No. PO',
        help_text='Al registrar este número se guarda automáticamente la fecha de aprobación.',
    )
    fecha_aprobacion = models.DateField(
        null=True, blank=True,
        verbose_name='Fecha Aprobación',
    )
    fecha_recibido  = models.DateField(
        null=True, blank=True,
        verbose_name='Fecha Recibido',
    )

    # ─── Proveedor / Logística ────────────────────────────────
    vendedor        = models.CharField(max_length=200, blank=True, verbose_name='Vendedor / Proveedor')
    comentarios     = models.TextField(blank=True, verbose_name='Comentarios')

    # ─── Auditoría ────────────────────────────────────────────
    creado_por      = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='ordenes_creadas',
        verbose_name='Creado por',
    )
    actualizado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='ordenes_actualizadas',
        verbose_name='Actualizado por',
    )
    creado_en       = models.DateTimeField(auto_now_add=True)
    actualizado_en  = models.DateTimeField(auto_now=True)

    # ─── Atributo transient (no se persiste) ──────────────────
    # El ViewSet lo lee para incluir una advertencia en la respuesta.
    _material_creado_inactivo: bool = False

    class Meta:
        verbose_name        = 'Orden de Compra'
        verbose_name_plural = 'Órdenes de Compra'
        ordering            = ['-fecha_emision', '-creado_en']

    def __str__(self):
        return f'OC #{self.pk} — {self.no_parte} × {self.cantidad} [{self.get_status_display()}]'

    # ─── Propiedades calculadas ───────────────────────────────

    @property
    def costo_total(self):
        if self.costo_unitario is not None and self.cantidad:
            return self.cantidad * self.costo_unitario
        return None

    @property
    def tiempo_entrega_dias(self):
        """Días transcurridos desde PO aprobada hasta recibido."""
        if self.fecha_aprobacion and self.fecha_recibido:
            return (self.fecha_recibido - self.fecha_aprobacion).days
        return None

    # ─── Rastreo de cambios ───────────────────────────────────

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.__old_status     = self.status
        self.__old_po_number  = self.po_number

    # ─── Lógica de negocio ────────────────────────────────────

    def save(self, *args, **kwargs):
        today = timezone.now().date()

        # Auto-fecha de aprobación al registrar PO number O al cambiar a estados de aprobación
        es_aprobado = self.status in ('pr_aprobada', 'po_aprobada')
        fue_aprobado = self.__old_status in ('pr_aprobada', 'po_aprobada')
        
        if (self.po_number and not self.__old_po_number) or (es_aprobado and not fue_aprobado):
            if not self.fecha_aprobacion:
                self.fecha_aprobacion = today

        # Auto-fecha de recibido al cambiar status a 'recibido' o 'rem_recibido'
        if self.status in ('recibido', 'rem_recibido') and self.__old_status not in ('recibido', 'rem_recibido'):
            if not self.fecha_recibido:
                self.fecha_recibido = today

        super().save(*args, **kwargs)

        # Actualizar stock DESPUÉS de guardar, solo en la transición → recibido / rem_recibido
        if self.status in ('recibido', 'rem_recibido') and self.__old_status not in ('recibido', 'rem_recibido'):
            self._material_creado_inactivo = self._actualizar_stock()

        # Actualizar los valores "viejos" para próximos saves
        self.__old_status    = self.status
        self.__old_po_number = self.po_number

    def _actualizar_stock(self) -> bool:
        """
        Suma la cantidad al stock del material vinculado.
        Si no existe, crea el material en estado INACTIVO.
        Crea siempre un registro Entrada para trazabilidad.

        Retorna True si se creó un material nuevo (inactivo).
        """
        from apps.materials.models import Material
        from apps.inventory.models  import Entrada

        creado_inactivo = False
        material = self.material

        if material is None:
            # Intentar encontrar por código de parte
            material = Material.objects.filter(code=self.no_parte).first()

            if material is None:
                # Crear material INACTIVO con datos mínimos
                material = Material.objects.create(
                    code=self.no_parte,
                    name=self.descripcion,
                    activo=False,          # ← INACTIVO: falta información
                    stock_actual=0,
                    stock_minimo=10,
                    stock_critico=5,
                    unit='pza',
                    descripcion=f'Creado automáticamente desde OC #{self.pk}. Completar información.',
                )
                creado_inactivo = True

            # Persistir el vínculo sin disparar save() completo otra vez
            OrdenCompra.objects.filter(pk=self.pk).update(material=material)
            self.material = material

        # Crear Entrada de trazabilidad
        Entrada.objects.create(
            material=material,
            cantidad=self.cantidad,
            proveedor=self.vendedor or 'OC automática',
            numero_orden=self.po_number or f'OC-{self.pk}',
            observaciones=(
                f'Entrada automática generada al marcar OC #{self.pk} como Recibida. '
                f'Vendedor: {self.vendedor or "—"}. Comentarios: {self.comentarios or "—"}'
            ),
        )

        return creado_inactivo
