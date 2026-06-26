"""analytics/views.py — Endpoints del dashboard analítico."""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Count, F, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from datetime import timedelta

from apps.accounts.permissions import IsSupervisorOrAbove
from apps.materials.models import Material
from apps.inventory.models import Entrada, Salida, Vale
from apps.purchases.models import OrdenCompra


class ResumenView(APIView):
    """
    Resumen general del inventario.
    Acceso: Supervisor y Manager.
    """
    permission_classes = [IsSupervisorOrAbove]

    def get(self, request):
        materiales = Material.objects.filter(activo=True)
        total = materiales.count()
        ok = sum(1 for m in materiales if m.estado == 'ok')
        ordenar = sum(1 for m in materiales if m.estado == 'ordenar')
        urge = sum(1 for m in materiales if m.estado == 'urge')

        # Movimientos del hoy
        hoy = timezone.now().date()
        entradas_hoy = Entrada.objects.filter(fecha__date=hoy).count()
        salidas_hoy = Salida.objects.filter(fecha__date=hoy).count()

        # Montos de órdenes activas (excluyendo recibidas y canceladas)
        ordenes_activas = OrdenCompra.objects.exclude(status__in=['recibido', 'rem_recibido', 'cancelado'])
        
        monto_mxn = ordenes_activas.filter(moneda='MXN').aggregate(
            total=Sum(F('cantidad') * F('costo_unitario'))
        )['total'] or 0
        
        monto_usd = ordenes_activas.filter(moneda='USD').aggregate(
            total=Sum(F('cantidad') * F('costo_unitario'))
        )['total'] or 0

        return Response({
            'materiales_total': total,
            'materiales_ok': ok,
            'materiales_ordenar': ordenar,
            'materiales_urge': urge,
            'entradas_hoy': entradas_hoy,
            'salidas_hoy': salidas_hoy,
            'ordenes_activas_monto_mxn': round(float(monto_mxn), 2),
            'ordenes_activas_monto_usd': round(float(monto_usd), 2),
            'ordenes_activas_count': ordenes_activas.count(),
        })


class ConsumoPorLineaView(APIView):
    """
    Consumo de materiales agrupado por línea de producción.
    Retorna las líneas con mayor consumo en los últimos 30 días.
    """
    permission_classes = [IsSupervisorOrAbove]

    def get(self, request):
        dias = int(request.query_params.get('dias', 30))
        desde = timezone.now() - timedelta(days=dias)

        consumo = (
            Salida.objects
            .filter(fecha__gte=desde)
            .values(
                linea_nombre=Coalesce(
                    F('linea__nombre'),
                    F('linea_legacy'),
                    Value('Sin asignar')
                )
            )
            .annotate(
                total_movimientos=Count('id'),
                total_unidades=Sum('cantidad'),
            )
            .order_by('-total_unidades')
        )

        return Response({
            'dias': dias,
            'data': list(consumo),
        })


class TopSalidasView(APIView):
    """
    Materiales que se despachan con más frecuencia.
    Top 10 en los últimos 30 días.
    """
    permission_classes = [IsSupervisorOrAbove]

    def get(self, request):
        dias = int(request.query_params.get('dias', 30))
        limite = int(request.query_params.get('limite', 10))
        desde = timezone.now() - timedelta(days=dias)

        top = (
            Salida.objects
            .filter(fecha__gte=desde)
            .values('material__id', 'material__code', 'material__name', 'material__unit')
            .annotate(
                total_movimientos=Count('id'),
                total_unidades=Sum('cantidad'),
            )
            .order_by('-total_movimientos')[:limite]
        )

        return Response({
            'dias': dias,
            'data': list(top),
        })


class AlertasView(APIView):
    """
    Materiales en estado 'ordenar' or 'urge'.
    Acceso: Supervisor y Manager.
    """
    permission_classes = [IsSupervisorOrAbove]

    def get(self, request):
        materiales = Material.objects.select_related('category').filter(activo=True)
        urge = [m for m in materiales if m.estado == 'urge']
        ordenar = [m for m in materiales if m.estado == 'ordenar']

        # Obtener OCs activas para estos materiales de forma eficiente
        material_ids = [m.id for m in urge] + [m.id for m in ordenar]
        active_orders = {}
        if material_ids:
            # Una orden se considera "activa" si no está recibida ni cancelada
            ocs = OrdenCompra.objects.filter(
                material_id__in=material_ids
            ).exclude(
                status__in=['recibido', 'rem_recibido', 'cancelado']
            ).order_by('material_id', '-fecha_emision')
            
            # Tomamos la más reciente para cada material
            for oc in ocs:
                if oc.material_id not in active_orders:
                    active_orders[oc.material_id] = {
                        'status': oc.status,
                        'label': oc.get_status_display()
                    }

        def serialize(m):
            return {
                'id': m.id,
                'code': m.code,
                'name': m.name,
                'unit': m.unit,
                'stock_actual': m.stock_actual,
                'stock_minimo': m.stock_minimo,
                'stock_critico': m.stock_critico,
                'estado': m.estado,
                'category': m.category.name if m.category else None,
                'active_order': active_orders.get(m.id),
            }

        return Response({
            'urge': [serialize(m) for m in urge],
            'ordenar': [serialize(m) for m in ordenar],
            'total_alertas': len(urge) + len(ordenar),
        })


class MovimientosRecientesView(APIView):
    """Últimas 20 entradas y salidas."""
    permission_classes = [IsSupervisorOrAbove]

    def get(self, request):
        entradas = (
            Entrada.objects
            .select_related('material', 'registrado_por')
            .order_by('-fecha')[:10]
        )
        salidas = (
            Salida.objects
            .select_related('material', 'registrado_por', 'linea', 'area')
            .order_by('-fecha')[:10]
        )
        vales = (
            Vale.objects
            .select_related('material', 'registrado_por', 'linea', 'area')
            .order_by('-fecha')[:10]
        )

        def fmt_entrada(e):
            return {
                'tipo': 'entrada',
                'id': e.id,
                'material_code': e.material.code,
                'material_name': e.material.name,
                'cantidad': e.cantidad,
                'fecha': e.fecha,
                'proveedor': e.proveedor,
                'usuario': e.registrado_por.username if e.registrado_por else None,
            }

        def fmt_salida(s):
            return {
                'tipo': 'salida',
                'id': s.id,
                'material_code': s.material.code,
                'material_name': s.material.name,
                'cantidad': s.cantidad,
                'fecha': s.fecha,
                'linea': s.linea.nombre if s.linea else s.linea_legacy,
                'area': s.area.nombre if s.area else s.seccion_legacy,
                'turno': s.turno,
                'recibio': s.recibio,
                'empleado_no': s.empleado_no,
                'observaciones': s.observaciones,
                'usuario': s.registrado_por.username if s.registrado_por else None,
            }

        def fmt_vale(v):
            return {
                'tipo': 'vale',
                'id': v.id,
                'recibo_no': v.recibo_no,
                'material_code': v.material.code,
                'material_name': v.material.name,
                'cantidad': v.cantidad,
                'fecha': v.fecha,
                'linea': v.linea.nombre if v.linea else '',
                'area': v.area.nombre if v.area else v.seccion_legacy,
                'recibio': v.empleado_nombre,
                'empleado_no': v.empleado_no,
                'observaciones': v.observaciones,
                'usuario': v.registrado_por.username if v.registrado_por else None,
            }

        return Response({
            'entradas': [fmt_entrada(e) for e in entradas],
            'salidas': [fmt_salida(s) for s in salidas],
            'vales': [fmt_vale(v) for v in vales],
        })



class SugerenciasCompraView(APIView):
    """
    Cálculos aproximados para sugerencias de compra:
    - Tiempo de entrega promedio por material (de OCs recibidas).
    - Consumo estimado basado en salidas.
    - Proyección de tiempo de agotamiento y tiempo para pedir más.
    """
    permission_classes = [IsSupervisorOrAbove]

    def get(self, request):
        dias_historial = 60
        desde = timezone.now() - timedelta(days=dias_historial)

        # 1. Consumo histórico
        consumo_data = (
            Salida.objects
            .filter(fecha__gte=desde)
            .values('material__id', 'material__stock_actual', 'material__code', 'material__name', 'material__unit')
            .annotate(total_salidas=Sum('cantidad'))
        )

        # 2. Tiempos de entrega promedios
        ocs = OrdenCompra.objects.filter(
            status='recibido',
            fecha_po_aprobada__isnull=False,
            fecha_recibido__isnull=False
        )
        lead_time_por_mat = {}
        for oc in ocs:
            if not oc.material_id: continue
            dias_entrega = oc.tiempo_entrega_dias or 14
            if oc.material_id not in lead_time_por_mat:
                lead_time_por_mat[oc.material_id] = []
            lead_time_por_mat[oc.material_id].append(dias_entrega)

        promedios_lt = {}
        for m_id, dias in lead_time_por_mat.items():
            promedios_lt[m_id] = sum(dias) / len(dias)

        sugerencias = []
        for c in consumo_data:
            mat_id = c['material__id']
            stock = c['material__stock_actual']
            salidas = c['total_salidas']
            consumo_diario = salidas / dias_historial

            if consumo_diario <= 0:
                continue

            dias_agotamiento = stock / consumo_diario
            lead_time = promedios_lt.get(mat_id, 14)  # 14 días por defecto si no hay historial de OCs

            dias_para_comprar = dias_agotamiento - lead_time

            sugerencias.append({
                'material_id': mat_id,
                'code': c['material__code'],
                'name': c['material__name'],
                'unit': c['material__unit'],
                'stock_actual': stock,
                'consumo_diario_estimado': round(consumo_diario, 2),
                'tiempo_entrega_estimado': round(lead_time),
                'dias_para_agotarse': round(dias_agotamiento),
                'dias_para_comprar': round(dias_para_comprar),
            })

        # Ordenar por urgencia (menor días_para_comprar primero)
        sugerencias.sort(key=lambda x: x['dias_para_comprar'])

        return Response(sugerencias[:15])  # Top 15 más urgentes


class ConsumoPorAreaView(APIView):
    """
    Consumo de materiales agrupado por línea y área.
    Permite filtrado más preciso combinando datos legacy y FK modernos.
    """
    permission_classes = [IsSupervisorOrAbove]

    def get(self, request):
        dias = int(request.query_params.get('dias', 30))
        linea_filter = request.query_params.get('linea', None)
        desde = timezone.now() - timedelta(days=dias)

        qs = Salida.objects.filter(fecha__gte=desde)

        if linea_filter:
            # Filtrar por nombre de línea (FK o legacy)
            from django.db.models import Q
            qs = qs.filter(
                Q(linea__nombre=linea_filter) | Q(linea_legacy=linea_filter)
            )

        consumo = (
            qs
            .values(
                linea_nombre=Coalesce(
                    F('linea__nombre'),
                    F('linea_legacy'),
                    Value('Sin asignar')
                ),
                area_nombre=Coalesce(
                    F('area__nombre'),
                    F('seccion_legacy'),
                    Value('General')
                ),
            )
            .annotate(
                total_movimientos=Count('id'),
                total_unidades=Sum('cantidad'),
            )
            .order_by('linea_nombre', '-total_unidades')
        )

        return Response({
            'dias': dias,
            'linea': linea_filter,
            'data': list(consumo),
        })
