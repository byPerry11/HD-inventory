"""
App: materials
Catálogo de materiales del almacén con cálculo automático de estado de stock.
"""
from django.db import models


class Category(models.Model):
    """Categoría o familia de materiales."""
    name = models.CharField(max_length=100, unique=True, verbose_name='Nombre')
    descripcion = models.TextField(blank=True, verbose_name='Descripción')

    class Meta:
        verbose_name = 'Categoría'
        verbose_name_plural = 'Categorías'
        ordering = ['name']

    def __str__(self):
        return self.name


class Material(models.Model):
    """
    Material del almacén.
    El estado (ok / ordenar / urge) se calcula automáticamente
    basado en stock_actual vs los umbrales stock_minimo y stock_critico.
    """
    UNIT_CHOICES = [
        ('pza', 'Pieza'),
        ('kg', 'Kilogramo'),
        ('lt', 'Litro'),
        ('mt', 'Metro'),
        ('caja', 'Caja'),
        ('rollo', 'Rollo'),
        ('bolsa', 'Bolsa'),
        ('par', 'Par'),
        ('juego', 'Juego'),
        ('otro', 'Otro'),
    ]

    # ─── Identificación ──────────────────────────────────────
    code = models.CharField(
        max_length=50, unique=True,
        verbose_name='Código',
        help_text='Código único del material (parte number o código interno)',
    )
    barcode = models.CharField(
        max_length=50, null=True, blank=True, unique=True,
        verbose_name='Código de Barras',
        help_text='Código de barras para escaneo rápido (EAN, UPC, code128)',
    )
    name = models.CharField(max_length=200, verbose_name='Nombre')
    image = models.ImageField(
        upload_to='materials/', null=True, blank=True,
        verbose_name='Imagen del producto',
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='materiales',
        verbose_name='Categoría',
    )
    unit = models.CharField(
        max_length=20,
        choices=UNIT_CHOICES,
        default='pza',
        verbose_name='Unidad de medida',
    )
    descripcion = models.TextField(blank=True, verbose_name='Descripción')
    ubicacion = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Ubicación en almacén',
        help_text='Posición o referencia en estante (ej. Locker 13-B, LOKER-amarillo)',
    )

    # ─── Stock ───────────────────────────────────────────────
    stock_actual = models.IntegerField(default=0, verbose_name='Stock Actual')
    stock_minimo = models.IntegerField(
        default=10,
        verbose_name='Stock Mínimo',
        help_text='Por debajo de este nivel el estado cambia a "Ordenar"',
    )
    stock_critico = models.IntegerField(
        default=5,
        verbose_name='Stock Crítico',
        help_text='Por debajo de este nivel el estado cambia a "Urge"',
    )

    # ─── Control ─────────────────────────────────────────────
    activo = models.BooleanField(default=True, verbose_name='Activo')
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Material'
        verbose_name_plural = 'Materiales'
        ordering = ['name']

    def __str__(self):
        return f"[{self.code}] {self.name}"

    # ─── Estado calculado ─────────────────────────────────────
    @property
    def estado(self):
        """Calcula el estado del stock automáticamente."""
        if self.stock_actual <= self.stock_critico:
            return 'urge'
        elif self.stock_actual <= self.stock_minimo:
            return 'ordenar'
        return 'ok'

    @property
    def estado_label(self):
        """Etiqueta legible del estado."""
        return {
            'urge': 'URGE',
            'ordenar': 'ORDENAR',
            'ok': 'OK',
        }[self.estado]
