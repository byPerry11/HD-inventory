"""analytics/views.py — Endpoints del dashboard analítico."""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Count, F, Value, Q
from django.db.models.functions import Coalesce
from django.utils import timezone
from datetime import timedelta

from apps.accounts.permissions import IsSupervisorOrAbove
from apps.materials.models import Material
from apps.inventory.models import Entrada, Salida, Vale, ValeItem
from apps.purchases.models import OrdenCompra


class ResumenView(APIView):
    """
    Resumen general del inventario + métricas de costo.
    Acceso: Supervisor y Manager.
    """
    permission_classes = [IsSupervisorOrAbove]

    def get(self, request):
        hoy = timezone.now().date()

        # ── Estado de materiales (estado es @property, se evalúa en Python) ──
        materiales = Material.objects.filter(activo=True).only(
            'id', 'stock_actual', 'stock_minimo', 'stock_critico'
        )
        total = ok = ordenar = urge = 0
        for m in materiales:
            total += 1
            if m.estado == 'ok':      ok += 1
            if m.estado == 'ordenar': ordenar += 1
            if m.estado == 'urge':    urge += 1

        # ── Movimientos del día ──
        entradas_hoy = Entrada.objects.filter(fecha__date=hoy).count()
        salidas_hoy = Salida.objects.filter(fecha__date=hoy).count()

        # ── Órdenes activas ──
        ordenes_activas = OrdenCompra.objects.exclude(
            status__in=['recibido', 'rem_recibido', 'cancelado']
        )
        monto_mxn = ordenes_activas.filter(moneda='MXN').aggregate(
            total=Sum(F('cantidad') * F('costo_unitario'))
        )['total'] or 0
        monto_usd = ordenes_activas.filter(moneda='USD').aggregate(
            total=Sum(F('cantidad') * F('costo_unitario'))
        )['total'] or 0

        # ── Métricas de costo (vales + salidas, último mes) ──
        desde = timezone.now() - timedelta(days=30)
        costo_vales = (
            ValeItem.objects.filter(vale__fecha__gte=desde)
            .aggregate(total=Sum(F('cantidad') * F('costo')))['total'] or 0
        )
        # Legacy vales (material único, sin items)
        costo_vales_legacy = (
            Vale.objects.filter(fecha__gte=desde, items__isnull=True)
            .exclude(material__isnull=True)
            .aggregate(total=Sum(F('cantidad') * F('costo')))['total'] or 0
        )

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
            'costo_consumo_mes': round(float(costo_vales + costo_vales_legacy), 2),
        })


class ConsumoPorLineaView(APIView):
    """
    Consumo de materiales agrupado por línea de producción,
    incluyendo Vales sin Salida asociada.
    """
    permission_classes = [IsSupervisorOrAbove]

    def get(self, request):
        try:
            dias = int(request.query_params.get('dias', 30))
        except (TypeError, ValueError):
            dias = 30
        dias = max(1, min(dias, 365))
        desde = timezone.now() - timedelta(days=dias)

        # Salidas
        salidas = (
            Salida.objects
            .filter(fecha__gte=desde)
            .values(
                linea_nombre=Coalesce(
                    F('linea__nombre'), F('linea_legacy'), Value('Sin asignar')
                )
            )
            .annotate(
                total_movimientos=Count('id'),
                total_unidades=Sum('cantidad'),
            )
        )

        # Vales sin salida asociada (para evitar doble conteo)
        vales = (
            Vale.objects
            .filter(fecha__gte=desde, salida__isnull=True)
            .values(
                linea_nombre=Coalesce(
                    F('linea__nombre'), Value('Sin asignar')
                )
            )
            .annotate(
                total_movimientos=Count('id'),
                total_unidades=Sum('items__cantidad'),
            )
        )

        # Merge
        merged = {}
        for row in salidas:
            ln = row['linea_nombre']
            merged[ln] = {
                'linea_nombre': ln,
                'total_movimientos': row['total_movimientos'],
                'total_unidades': row['total_unidades'] or 0,
            }
        for row in vales:
            ln = row['linea_nombre']
            if ln in merged:
                merged[ln]['total_movimientos'] += row['total_movimientos']
                merged[ln]['total_unidades'] += row['total_unidades'] or 0
            else:
                merged[ln] = {
                    'linea_nombre': ln,
                    'total_movimientos': row['total_movimientos'],
                    'total_unidades': row['total_unidades'] or 0,
                }

        data = sorted(merged.values(), key=lambda x: -x['total_unidades'])

        return Response({'dias': dias, 'data': data})


class TopSalidasView(APIView):
    """
    Materiales más despachados (Salidas + Vales sin Salida).
    Top 10 en los últimos N días.
    """
    permission_classes = [IsSupervisorOrAbove]

    def get(self, request):
        try:
            dias = int(request.query_params.get('dias', 30))
        except (TypeError, ValueError):
            dias = 30
        try:
            limite = int(request.query_params.get('limite', 10))
        except (TypeError, ValueError):
            limite = 10
        dias = max(1, min(dias, 365))
        limite = max(1, min(limite, 100))
        desde = timezone.now() - timedelta(days=dias)

        # Salidas agrupadas por material
        salidas = (
            Salida.objects
            .filter(fecha__gte=desde)
            .values(
                'material_id',
                'material__code',
                'material__name',
                'material__unit',
            )
            .annotate(
                total_movimientos=Count('id'),
                total_unidades=Sum('cantidad'),
            )
        )

        # ValeItems de vales sin salida
        vales = (
            ValeItem.objects
            .filter(vale__fecha__gte=desde, vale__salida__isnull=True)
            .values(
                'material_id',
                'material__code',
                'material__name',
                'material__unit',
            )
            .annotate(
                total_movimientos=Count('vale__id', distinct=True),
                total_unidades=Sum('cantidad'),
            )
        )

        merged = {}
        for row in salidas:
            mid = row['material_id']
            merged[mid] = {
                'material__id': mid,
                'material__code': row['material__code'],
                'material__name': row['material__name'],
                'material__unit': row['material__unit'],
                'total_movimientos': row['total_movimientos'],
                'total_unidades': row['total_unidades'] or 0,
            }
        for row in vales:
            mid = row['material_id']
            if mid in merged:
                merged[mid]['total_movimientos'] += row['total_movimientos']
                merged[mid]['total_unidades'] += row['total_unidades'] or 0
            else:
                merged[mid] = {
                    'material__id': mid,
                    'material__code': row['material__code'],
                    'material__name': row['material__name'],
                    'material__unit': row['material__unit'],
                    'total_movimientos': row['total_movimientos'],
                    'total_unidades': row['total_unidades'] or 0,
                }

        data = sorted(merged.values(), key=lambda x: -x['total_movimientos'])[:limite]

        return Response({'dias': dias, 'data': data})


class AlertasView(APIView):
    """Materiales en estado 'ordenar' or 'urge'."""
    permission_classes = [IsSupervisorOrAbove]

    def get(self, request):
        materiales = Material.objects.select_related('category').filter(activo=True)
        urge = [m for m in materiales if m.estado == 'urge']
        ordenar = [m for m in materiales if m.estado == 'ordenar']

        material_ids = [m.id for m in urge] + [m.id for m in ordenar]
        active_orders = {}
        if material_ids:
            ocs = OrdenCompra.objects.filter(
                material_id__in=material_ids
            ).exclude(
                status__in=['recibido', 'rem_recibido', 'cancelado']
            ).order_by('material_id', '-fecha_emision')

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
    """Últimas 20 entradas, salidas y vales."""
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
            .prefetch_related('items__material')
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
            items = list(v.items.all())
            total_qty = sum(i.cantidad for i in items) if items else (v.cantidad or 0)
            first = items[0] if items else None
            if first:
                m_code = first.material.code
                m_name = first.material.name
            elif v.material:
                m_code = v.material.code
                m_name = v.material.name
            else:
                m_code = ''
                m_name = ''
            return {
                'tipo': 'vale',
                'id': v.id,
                'recibo_no': v.recibo_no,
                'material_code': m_code,
                'material_name': m_name,
                'cantidad': total_qty,
                'items': [
                    {
                        'material_code': i.material.code,
                        'material_name': i.material.name,
                        'cantidad': i.cantidad,
                        'costo': float(i.costo),
                    } for i in items
                ] if items else [],
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
    Sugerencias de compra basadas en Salidas + Vales (consumo real).
    Incluye consumo de vales sin salida asociada.
    """
    permission_classes = [IsSupervisorOrAbove]

    def get(self, request):
        dias_historial = 60
        desde = timezone.now() - timedelta(days=dias_historial)

        # Consumo via Salidas
        salida_data = (
            Salida.objects
            .filter(fecha__gte=desde)
            .values(
                'material__id', 'material__stock_actual',
                'material__code', 'material__name', 'material__unit')
            .annotate(total_salidas=Sum('cantidad'))
        )
        # Consumo via ValeItem (vales sin salida)
        vale_data = (
            ValeItem.objects
            .filter(vale__fecha__gte=desde, vale__salida__isnull=True)
            .values(
                'material__id', 'material__stock_actual',
                'material__code', 'material__name', 'material__unit')
            .annotate(total_salidas=Sum('cantidad'))
        )

        # Merge consumo
        consumo_map = {}
        for c in salida_data:
            mid = c['material__id']
            consumo_map[mid] = {
                'material__id': mid,
                'material__stock_actual': c['material__stock_actual'],
                'material__code': c['material__code'],
                'material__name': c['material__name'],
                'material__unit': c['material__unit'],
                'total_salidas': c['total_salidas'] or 0,
            }
        for c in vale_data:
            mid = c['material__id']
            if mid in consumo_map:
                consumo_map[mid]['total_salidas'] += c['total_salidas'] or 0
            else:
                consumo_map[mid] = {
                    'material__id': mid,
                    'material__stock_actual': c['material__stock_actual'],
                    'material__code': c['material__code'],
                    'material__name': c['material__name'],
                    'material__unit': c['material__unit'],
                    'total_salidas': c['total_salidas'] or 0,
                }

        # Lead times
        ocs = OrdenCompra.objects.filter(
            status='recibido',
            fecha_po_aprobada__isnull=False,
            fecha_recibido__isnull=False
        )
        lead_time_por_mat = {}
        for oc in ocs:
            if not oc.material_id:
                continue
            dias_entrega = oc.tiempo_entrega_dias or 14
            lead_time_por_mat.setdefault(oc.material_id, []).append(dias_entrega)

        promedios_lt = {
            m_id: sum(dias) / len(dias)
            for m_id, dias in lead_time_por_mat.items()
        }

        sugerencias = []
        for c in consumo_map.values():
            mat_id = c['material__id']
            stock = c['material__stock_actual']
            salidas = c['total_salidas']
            consumo_diario = salidas / dias_historial

            if consumo_diario <= 0:
                continue

            dias_agotamiento = stock / consumo_diario
            lead_time = round(promedios_lt.get(mat_id, 14))
            dias_para_comprar = round(dias_agotamiento - lead_time)

            sugerencias.append({
                'material_id': mat_id,
                'code': c['material__code'],
                'name': c['material__name'],
                'unit': c['material__unit'],
                'stock_actual': stock,
                'consumo_diario_estimado': round(consumo_diario, 2),
                'tiempo_entrega_estimado': lead_time,
                'dias_para_agotarse': round(dias_agotamiento),
                'dias_para_comprar': dias_para_comprar,
            })

        sugerencias.sort(key=lambda x: x['dias_para_comprar'])

        return Response(sugerencias[:15])


class ConsumoPorAreaView(APIView):
    """Consumo agrupado por línea y área (Salidas + Vales sin salida)."""
    permission_classes = [IsSupervisorOrAbove]

    def get(self, request):
        try:
            dias = int(request.query_params.get('dias', 30))
        except (TypeError, ValueError):
            dias = 30
        dias = max(1, min(dias, 365))
        linea_filter = request.query_params.get('linea', None)
        desde = timezone.now() - timedelta(days=dias)

        qs = Salida.objects.filter(fecha__gte=desde)
        if linea_filter:
            qs = qs.filter(
                Q(linea__nombre=linea_filter) | Q(linea_legacy=linea_filter)
            )

        salida_consumo = (
            qs
            .values(
                linea_nombre=Coalesce(
                    F('linea__nombre'), F('linea_legacy'), Value('Sin asignar')
                ),
                area_nombre=Coalesce(
                    F('area__nombre'), F('seccion_legacy'), Value('General')
                ),
            )
            .annotate(
                total_movimientos=Count('id'),
                total_unidades=Sum('cantidad'),
            )
        )

        # Vales sin salida
        vqs = Vale.objects.filter(fecha__gte=desde, salida__isnull=True)
        if linea_filter:
            vqs = vqs.filter(linea__nombre=linea_filter)

        vale_consumo = (
            vqs
            .values(
                linea_nombre=Coalesce(
                    F('linea__nombre'), Value('Sin asignar')
                ),
                area_nombre=Coalesce(
                    F('area__nombre'), Value('General')
                ),
            )
            .annotate(
                total_movimientos=Count('id'),
                total_unidades=Sum('items__cantidad'),
            )
        )

        merged = {}
        for row in list(salida_consumo) + list(vale_consumo):
            key = (row['linea_nombre'], row['area_nombre'])
            if key in merged:
                merged[key]['total_movimientos'] += row['total_movimientos']
                merged[key]['total_unidades'] += row['total_unidades'] or 0
            else:
                merged[key] = {
                    'linea_nombre': row['linea_nombre'],
                    'area_nombre': row['area_nombre'],
                    'total_movimientos': row['total_movimientos'],
                    'total_unidades': row['total_unidades'] or 0,
                }

        return Response({
            'dias': dias,
            'linea': linea_filter,
            'data': sorted(merged.values(), key=lambda x: (-x['total_unidades'], x['linea_nombre'])),
        })
