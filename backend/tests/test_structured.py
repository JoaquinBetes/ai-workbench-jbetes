from app.structured import errores_de_esquema, exactitud, extraer_json

ESQUEMA = {
    "type": "object",
    "properties": {"nombre": {"type": "string"}, "edad": {"type": "integer"}},
    "required": ["nombre", "edad"],
}


def test_extrae_de_bloque_de_codigo_con_texto_alrededor():
    texto = 'Claro, acá tenés:\n```json\n{"nombre": "Ana", "edad": 30}\n```\n¡Saludos!'
    obj, pasos = extraer_json(texto)
    assert obj == {"nombre": "Ana", "edad": 30}
    assert any("bloque de código" in p for p in pasos)


def test_repara_coma_final_y_literales_de_python():
    obj, pasos = extraer_json("{'nombre': 'Ana', 'activo': True,}")
    assert obj == {"nombre": "Ana", "activo": True}
    assert "quitó comas finales sobrantes" in pasos


def test_llaves_dentro_de_strings_no_confunden():
    obj, _ = extraer_json('Respuesta: {"texto": "a } b", "n": 1} y algo más')
    assert obj == {"texto": "a } b", "n": 1}


def test_sin_json():
    obj, pasos = extraer_json("No sé la respuesta.")
    assert obj is None and pasos


def test_validacion_de_esquema():
    assert errores_de_esquema({"nombre": "Ana", "edad": 30}, ESQUEMA) == []
    errores = errores_de_esquema({"nombre": "Ana", "edad": "treinta"}, ESQUEMA)
    assert errores and errores[0].startswith("edad")


def test_exactitud_por_campos():
    esperado = {"nombre": "Lucía Fernández", "edad": 29, "items": [{"n": "alfajores", "c": 3}]}
    obtenido = {"nombre": "lucia fernandez", "edad": 28, "items": [{"n": "Alfajor", "c": 3}]}
    assert exactitud(esperado, obtenido) == 0.75  # nombre ✓, edad ✗, n ✓, c ✓
    assert exactitud(esperado, None) == 0.0
