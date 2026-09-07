from rest_framework.pagination import PageNumberPagination

class CustomPagination(PageNumberPagination):
    """
    Paginación personalizada que permite a los clientes solicitar
    un tamaño de página específico usando el parámetro ?page_size=
    """
    page_size_query_param = 'page_size'
    max_page_size = 100
    page_size = 50
