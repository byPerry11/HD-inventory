"""
purchases/models.py — Órdenes de Compra (Purchase Orders)

Flujo de estados:
  En Proceso → PO Aprobada → Recibido
                           ↘ Cancelado

Al cambiar a 'recibido':
  - Busca el material por FK o por no_parte (code).
  - Si existe: lo activa si estaba inactivo, suma cantidad al stock_actual y
    crea una Entrada de trazabilidad.
  - Si NO existe: crea el material en estado ACTIVO y establece
    stock_actual = cantidad.
    La instancia guarda self._material_creado_automaticamente = True para que
    el ViewSet pueda incluir una advertencia en la respuesta.
"""
from django.db import models
from django.db.models.functions import Lower
from django.conf import settings
from django.utils import timezone


class Proveedor(models.Model):
    """Modelo para gestionar proveedores del almacén."""
    nombre = models.CharField(max_length=200, verbose_name='Nombre')
    contacto = models.CharField(max_length=200, blank=True, verbose_name='Persona de Contacto')
    telefono = models.CharField(max_length=50, blank=True, verbose_name='Teléfono')
    email = models.EmailField(blank=True, verbose_name='Email')
    direccion = models.TextField(blank=True, verbose_name='Dirección')
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Proveedor'
        verbose_name_plural = 'Proveedores'
        ordering = ['nombre']
        constraints = [
            models.UniqueConstraint(
                Lower('nombre'),
                name='proveedor_nombre_ci_unique',
            ),
        ]

    def __str__(self):
        return self.nombre

    @classmethod
    def get_or_create_canonical(cls, nombre):
        """
        Devuelve el proveedor canónico (el más antiguo) cuyo nombre coincida
        ignorando mayúsculas/minúsculas. Si no existe, lo crea.

        Así se garantiza que un mismo proveedor nunca se duplique por variar
        la capitalización del nombre.
        """
        nombre = (nombre or '').strip()
        if not nombre:
            return None
        existente = cls.objects.filter(nombre__iexact=nombre).order_by('id').first()
        if existente:
            return existente
        return cls.objects.create(nombre=nombre)

    def save(self, *args, **kwargs):
        self.nombre = (self.nombre or '').strip()
        if not self.nombre:
            raise ValueError('El nombre del proveedor no puede estar vacío.')
        super().save(*args, **kwargs)


class OrdenCompra(models.Model):

    FLUJO_ESTANDAR  = ['pr_creada', 'pr_aprobada', 'po_aprobada', 'ordenado', 'recibido']
    FLUJO_REM       = ['pedido_rem', 'rem_recibido']
    ESTADOS_CERRADO = {'recibido', 'rem_recibido'}
    ESTADOS_CANCELABLE = {'pr_creada', 'pr_aprobada', 'po_aprobada', 'pedido_rem'}

    STATUS_CHOICES = [
        ('pr_creada',    'PR Creada'),
        ('pr_aprobada',  'PR Aprobada'),
        ('po_aprobada',  'PO Aprobada'),
        ('ordenado',     'Ordenado'),
        ('recibido',     'Recibido'),
        ('pedido_rem',   'Pedido REM'),
        ('rem_recibido', 'REM Recibido'),
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

    # ─── Estado / PO / PR ────────────────────────────────────
    status          = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pr_creada',
        db_index=True,
        verbose_name='Estado',
    )
    no_pr           = models.CharField(
        max_length=100, blank=True,
        verbose_name='No. PR',
        help_text='Requerido para flujo estándar.'
    )
    po_number       = models.CharField(
        max_length=100, blank=True,
        verbose_name='No. PO',
        help_text='Se captura al avanzar a PO Aprobada.',
    )
    es_remision     = models.BooleanField(
        default=False,
        verbose_name='Pedido por Remisión'
    )

    # ─── Fechas de Auditoría por Paso ────────────────────────
    fecha_pr           = models.DateTimeField(null=True, blank=True, verbose_name='Fecha PR / Pedido REM')
    fecha_pr_aprobada  = models.DateTimeField(null=True, blank=True, verbose_name='Fecha PR Aprobada')
    fecha_po_aprobada  = models.DateTimeField(null=True, blank=True, verbose_name='Fecha PO Aprobada')
    fecha_ordenado     = models.DateTimeField(null=True, blank=True, verbose_name='Fecha Ordenado')
    fecha_recibido     = models.DateTimeField(null=True, blank=True, verbose_name='Fecha Recibido')
    recibido_por       = models.CharField(
        max_length=200, blank=True,
        verbose_name='Recibido por',
        help_text='Nombre de la persona que recibió el material.'
    )
    
    # ─── Proveedor / Logística ────────────────────────────────
    vendedor        = models.CharField(max_length=200, blank=True, verbose_name='Vendedor (Texto)')
    proveedor_ref   = models.ForeignKey(
        Proveedor,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ordenes',
        verbose_name='Proveedor Relacionado'
    )
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
    _material_creado_automaticamente: bool = False

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
        if self.fecha_po_aprobada and self.fecha_recibido:
            # Ambos son DateTimeField, convertimos ambos a date antes de restar
            d_recibido = self.fecha_recibido.date() if hasattr(self.fecha_recibido, 'date') else self.fecha_recibido
            d_po = self.fecha_po_aprobada.date() if hasattr(self.fecha_po_aprobada, 'date') else self.fecha_po_aprobada
            return (d_recibido - d_po).days
        return None

    # ─── Rastreo de cambios ───────────────────────────────────

    @classmethod
    def from_db(cls, db, field_names, values):
        instance = super().from_db(db, field_names, values)
        instance._loaded_values = dict(zip(field_names, values))
        return instance

    def refresh_from_db(self, db=None, fields=None):
        super().refresh_from_db(db, fields)
        if hasattr(self, '_loaded_values'):
            for field in fields or self._loaded_values.keys():
                self._loaded_values[field] = getattr(self, field)
        else:
            self._loaded_values = {
                field: getattr(self, field)
                for field in (fields or [f.name for f in self._meta.fields])
            }

    # ─── Lógica de negocio ────────────────────────────────────

    @staticmethod
    def get_siguiente_status(status_actual, es_remision=False):
        flujo = OrdenCompra.FLUJO_REM if es_remision else OrdenCompra.FLUJO_ESTANDAR
        try:
            idx = flujo.index(status_actual)
            if idx + 1 < len(flujo):
                return flujo[idx + 1]
        except ValueError:
            pass
        return None

    def save(self, *args, **kwargs):
        from django.db import transaction
        with transaction.atomic():
            # Auto-registro de proveedor: si la orden tiene nombre de vendedor,
            # se persiste/vincula al catálogo de proveedores (case-insensitive).
            if self.vendedor and self.vendedor.strip():
                self.proveedor_ref = Proveedor.get_or_create_canonical(self.vendedor)
            else:
                self.proveedor_ref = None

            now = timezone.now()

            # Si es nueva, o cambió el status, capturamos fechas
            is_new = self.pk is None
            old_status = getattr(self, '_loaded_values', {}).get('status', self.status)
            status_changed = is_new or (self.status != old_status)

            if status_changed:
                # Limpieza de fechas y campos según el estado al transicionar,
                # para evitar inconsistencias (solo al cambiar de status).
                if self.status not in ('recibido', 'rem_recibido'):
                    self.fecha_recibido = None
                    self.recibido_por = ''
                if self.status not in ('ordenado', 'recibido', 'rem_recibido'):
                    self.fecha_ordenado = None
                if self.status not in ('po_aprobada', 'ordenado', 'recibido', 'rem_recibido'):
                    self.fecha_po_aprobada = None
                if self.status not in ('pr_aprobada', 'po_aprobada', 'ordenado', 'recibido', 'rem_recibido'):
                    self.fecha_pr_aprobada = None

                if self.status in ('pr_creada', 'pedido_rem') and not self.fecha_pr:
                    self.fecha_pr = now
                elif self.status == 'pr_aprobada' and not self.fecha_pr_aprobada:
                    self.fecha_pr_aprobada = now
                elif self.status == 'po_aprobada' and not self.fecha_po_aprobada:
                    self.fecha_po_aprobada = now
                elif self.status == 'ordenado' and not self.fecha_ordenado:
                    self.fecha_ordenado = now
                elif self.status in ('recibido', 'rem_recibido') and not self.fecha_recibido:
                    self.fecha_recibido = now

            super().save(*args, **kwargs)

            # Actualizar stock DESPUÉS de guardar, solo en la transición → recibido / rem_recibido
            was_received = old_status in ('recibido', 'rem_recibido') and not is_new
            is_received = self.status in ('recibido', 'rem_recibido')

            if is_received and not was_received:
                self._material_creado_automaticamente = self._actualizar_stock()
            elif was_received and not is_received:
                self._revertir_stock()

            # Actualizar los valores cargados en memoria
            if hasattr(self, '_loaded_values'):
                self._loaded_values['status'] = self.status
            else:
                self._loaded_values = {'status': self.status}

    def _revertir_stock(self):
        """
        Revierte el stock al sacar una orden de recibido/rem_recibido,
        eliminando UNA sola Entrada de trazabilidad (la más reciente que
        coincida). La resta la ejecuta el signal post_delete de Entrada,
        única fuente de verdad del stock.
        """
        if self.material:
            from apps.inventory.models import Entrada

            entrada = Entrada.objects.filter(
                material=self.material,
                cantidad=self.cantidad,
                numero_orden=self.po_number or f'OC-{self.pk}'
            ).order_by('-id').first()
            if entrada:
                entrada.delete()

    def _actualizar_stock(self) -> bool:
        """
        Suma la cantidad al stock del material vinculado.
        Si no existe, crea el material en estado ACTIVO.
        Si existe pero está inactivo, lo reactiva para que sea visible.
        Crea siempre un registro Entrada para trazabilidad.

        Retorna True si se creó un material nuevo.
        """
        from apps.materials.models import Material
        from apps.inventory.models  import Entrada

        creado_automaticamente = False
        material = self.material

        if material is None:
            # Intentar encontrar por código de parte
            material = Material.objects.filter(code=self.no_parte).first()

            if material is None:
                # Crear material ACTIVO con datos mínimos
                material = Material.objects.create(
                    code=self.no_parte,
                    name=self.descripcion,
                    activo=True,
                    stock_actual=0,
                    stock_minimo=10,
                    stock_critico=5,
                    unit='pza',
                    descripcion=f'Creado automáticamente desde OC #{self.pk}. Completar información.',
                )
                creado_automaticamente = True

            # Persistir el vínculo sin disparar save() completo otra vez
            OrdenCompra.objects.filter(pk=self.pk).update(material=material)
            self.material = material

        if not material.activo:
            material.activo = True
            material.save(update_fields=['activo', 'actualizado_en'])

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

        return creado_automaticamente
