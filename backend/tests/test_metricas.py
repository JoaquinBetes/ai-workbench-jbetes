import math

import numpy as np

from app.eval import metricas as m
from app.routers.evaluacion import proyectar


def test_normalizar_saca_tildes_puntuacion_y_articulos():
    assert m.normalizar("¡La Capital es Canberra!") == "capital es canberra"
    assert m.normalizar("  Júpiter.  ") == "jupiter"


def test_exacta_y_normalizada():
    assert m.exacta("Canberra", " Canberra ")
    assert not m.exacta("Canberra", "canberra.")
    assert m.normalizada("Canberra", "canberra.")


def test_contiene_respeta_palabras_completas():
    assert m.contiene("Canberra", "La capital es Canberra.")
    assert m.contiene("Buenos Aires", "Nació en Buenos Aires, Argentina.")
    assert not m.contiene("13", "La raíz es 130.")  # no vale un pedazo de número


def test_edicion():
    assert m.edicion("hola", "hola") == 1
    assert math.isclose(m.edicion("gato", "pato"), 0.75)


def test_rouge_l_con_parafrasis():
    # mismas palabras en otro orden: la subsecuencia común es más corta que la oración
    r = m.rouge_l("La capital de Australia es Canberra", "Canberra es la capital australiana")
    assert 0 < r < 1
    assert m.rouge_l("hola mundo", "hola mundo") == 1


def test_bleu_identica_y_distinta():
    assert math.isclose(m.bleu("the cat sleeps on the sofa", "the cat sleeps on the sofa"), 1.0)
    assert m.bleu("Canberra", "Sídney") == 0
    # una respuesta corta correcta no da 0 aunque la referencia tenga más palabras
    assert m.bleu("dióxido de carbono", "dióxido de carbono") == 1
    assert 0 < m.bleu("It will rain tomorrow", "Tomorrow it will rain") < 1


def test_coseno_y_perplejidad():
    assert math.isclose(m.coseno([1, 0], [1, 0]), 1)
    assert math.isclose(m.coseno([1, 0], [0, 1]), 0)
    assert math.isclose(m.perplejidad([0.0, 0.0]), 1)
    assert math.isclose(m.perplejidad([math.log(0.5)] * 3), 2)
    assert m.perplejidad([]) is None


def test_agregar_promedia_y_cuenta_booleanos():
    filas = [
        {**m.lexicas("Canberra", "Canberra"), "semantica": 1.0, "perplejidad": 1.2, "latencia": 0.5, "tokens": 3},
        {**m.lexicas("Canberra", "Sídney"), "semantica": None, "perplejidad": None, "latencia": 0.7, "tokens": 4},
    ]
    a = m.agregar(filas)
    assert a["casos"] == 2 and a["exacta"] == 0.5 and a["semantica"] == 1.0 and a["tokens"] == 7


def test_proyectar_a_tres_dimensiones():
    rng = np.random.default_rng(0)
    puntos = proyectar(rng.normal(size=(10, 32)))
    assert puntos.shape == (10, 3)
    assert np.abs(puntos).max() <= 1.0 + 1e-9
    assert proyectar(rng.normal(size=(2, 8))).shape == (2, 3)
