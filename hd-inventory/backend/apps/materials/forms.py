from django import forms

class MaterialCSVImportForm(forms.Form):
    csv_file = forms.FileField(
        label="Archivo CSV",
        help_text="Seleccione un archivo .csv con los datos de los materiales.",
        required=True
    )

    def clean_csv_file(self):
        file = self.cleaned_data.get('csv_file')
        if file:
            if not file.name.endswith('.csv'):
                raise forms.ValidationError("El archivo debe tener extensión .csv")
        return file
