"""
App: inventory — Modelos de Entradas y Salidas
Los signals actualizan el stock_actual del material automáticamente.
"""
from django.db import models
from django.conf import settings
from apps.materials.models import Material


TURNO_CHOICES = [
    ('1st Shift', '1st Shift'),
    ('2nd Shift', '2nd Shift'),
    ('3rd Shift', '3rd Shift'),
]

LINEA_CHOICES = [
    ('T01', 'T01'),
    ('T02', 'T02'),
    ('T03', 'T03'),
    ('T05', 'T05'),
    ('T06', 'T06'),
    ('T07', 'T07'),
    ('T08', 'T08'),
    ('C01', 'C01'),
    ('Mantenimiento', 'Mantenimiento'),
    ('PE', 'PE'),
    ('IE', 'IE'),
    ('IT', 'IT'),
    ('IPQC', 'IPQC'),
    ('RD', 'RD'),
    ('Panel', 'Panel'),
    ('OQA', 'OQA'),
]

class Seccion(models.Model):
    """
    Catálogo de secciones para las salidas, administrable por supervisores/managers.
    """
    nombre = models.CharField(max_length=100, unique=True, verbose_name="Nombre de la Sección")

    class Meta:
        verbose_name = 'Sección'
        verbose_name_plural = 'Secciones'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


class Area(models.Model):
    """
    Catálogo de áreas (anteriormente líneas) administrable.
    """
    nombre = models.CharField(max_length=100, unique=True, verbose_name="Nombre del Área")

    class Meta:
        verbose_name = 'Área'
        verbose_name_plural = 'Áreas'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre
class Entrada(models.Model):
    """
    Registro de entrada de material al almacén.
    Al guardar, el signal suma la cantidad al stock_actual del material.
    """
    material = models.ForeignKey(
        Material,
        on_delete=models.PROTECT,
        related_name='entradas',
        verbose_name='Material',
    )
    cantidad = models.PositiveIntegerField(verbose_name='Cantidad')
    fecha = models.DateTimeField(auto_now_add=True, verbose_name='Fecha y Hora')

    # Datos del proveedor / orden de compra
    proveedor = models.CharField(max_length=200, blank=True, verbose_name='Proveedor')
    numero_orden = models.CharField(max_length=100, blank=True, verbose_name='No. Orden / Remisión')
    observaciones = models.TextField(blank=True, verbose_name='Observaciones')

    # Usuario que registra
    registrado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='entradas_registradas',
        verbose_name='Registrado por',
    )

    class Meta:
        verbose_name = 'Entrada'
        verbose_name_plural = 'Entradas'
        ordering = ['-fecha']

    def __str__(self):
        return f"Entrada #{self.pk} — {self.material.code} x{self.cantidad}"


class Salida(models.Model):
    """
    Registro de salida de material del almacén.
    Al guardar, el signal resta la cantidad del stock_actual del material.
    """
    material = models.ForeignKey(
        Material,
        on_delete=models.PROTECT,
        related_name='salidas',
        verbose_name='Material (Parte)',
    )
    cantidad = models.PositiveIntegerField(verbose_name='Cantidad')
    fecha = models.DateTimeField(auto_now_add=True, verbose_name='Fecha y Hora')

    # Destino del material (Legacy)
    linea_legacy = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='Línea (Legacy)',
    )
    seccion_legacy = models.CharField(
        max_length=100, 
        blank=True, 
        verbose_name='Sección (Legacy)'
    )
    
    # Nuevas llaves foráneas
    area = models.ForeignKey(
        Area,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='salidas',
        verbose_name='Área'
    )
    seccion = models.ForeignKey(
        Seccion,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='salidas',
        verbose_name='Sección'
    )
    turno = models.CharField(
        max_length=20,
        choices=TURNO_CHOICES,
        verbose_name='Turno',
    )

    # Persona que retira el material de producción
    empleado_no = models.CharField(max_length=50, blank=True, verbose_name='No. Empleado')
    recibio = models.CharField(max_length=200, verbose_name='Recibió')
    observaciones = models.TextField(blank=True, verbose_name='Comentarios')

    # Usuario que registra la salida (auto-filled desde la sesión)
    registrado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='salidas_registradas',
        verbose_name='Capturado por',
    )

    class Meta:
        verbose_name = 'Salida'
        verbose_name_plural = 'Salidas'
        ordering = ['-fecha']

    def __str__(self):
        return f"Salida #{self.pk} — {self.material.code} x{self.cantidad} → {self.linea}"


class Vale(models.Model):
    """
    Vale / Comprobante de salida basado en un recibo.
    """
    empleado_no = models.CharField(max_length=50, verbose_name='No. Empleado')
    empleado_nombre = models.CharField(max_length=200, verbose_name='Nombre del Empleado')
    recibo_no = models.PositiveIntegerField(null=True, blank=True, unique=True, verbose_name='Recibo No.')
    salida = models.ForeignKey(
        Salida,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='vales',
        verbose_name='Salida Relacionada'
    )
    seccion_legacy = models.CharField(
        max_length=100, 
        blank=True, 
        verbose_name='Sección (Legacy)'
    )
    area = models.ForeignKey(
        Area,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='vales',
        verbose_name='Área'
    )
    seccion = models.ForeignKey(
        Seccion,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='vales',
        verbose_name='Sección'
    )
    fecha = models.DateTimeField(auto_now_add=True, verbose_name='Fecha')

    # Referencia al material (número de parte)
    material = models.ForeignKey(
        Material,
        on_delete=models.PROTECT,
        related_name='vales',
        verbose_name='Material (Parte)'
    )
    aut = models.CharField(max_length=200, blank=True, verbose_name='Aut')
    cantidad = models.PositiveIntegerField(verbose_name='Cantidad')
    costo = models.DecimalField(max_digits=12, decimal_places=2, verbose_name='Costo')
    observaciones = models.TextField(blank=True, verbose_name='Observaciones')

    registrado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='vales_registrados',
        verbose_name='Capturado por',
    )

    class Meta:
        verbose_name = 'Vale'
        verbose_name_plural = 'Vales'
        ordering = ['-fecha']

    def __str__(self):
        return f"Vale #{self.recibo_no or self.pk} — {self.material.code} x{self.cantidad}"

    def save(self, *args, **kwargs):
        # Asigna recibo_no auto-incremental si no se proporciona
        if not self.recibo_no:
            last = Vale.objects.order_by('-recibo_no').first()
            self.recibo_no = (last.recibo_no if last and last.recibo_no else 0) + 1
        return super().save(*args, **kwargs)


class Empleado(models.Model):
    """
    Catálogo de empleados para auto-completado en vales y salidas.
    """
    numero = models.CharField(max_length=50, unique=True, verbose_name='No. Empleado')
    nombre = models.CharField(max_length=255, verbose_name='Nombre')

    class Meta:
        verbose_name = 'Empleado'
        verbose_name_plural = 'Empleados'
        ordering = ['numero']

    def __str__(self):
        return f"{self.numero} — {self.nombre}"
