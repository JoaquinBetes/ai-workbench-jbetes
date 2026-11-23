from app.routers.chat import Message, armar_prompt_chatml


def test_prompt_sin_razonamiento_deja_el_turno_abierto():
    prompt = armar_prompt_chatml(
        [Message(role="system", content="Sé breve."), Message(role="user", content="Hola")],
        prefix="Buen",
        thinking=None,
    )
    assert prompt == (
        "<|im_start|>system\nSé breve.<|im_end|>\n"
        "<|im_start|>user\nHola<|im_end|>\n"
        "<|im_start|>assistant\n<think>\n\n</think>\n\nBuen"
    )
    assert not prompt.endswith("<|im_end|>\n")


def test_prompt_con_razonamiento():
    prompt = armar_prompt_chatml([Message(role="user", content="2+2")], prefix="Es", thinking=" sumo \n")
    assert prompt.endswith("<|im_start|>assistant\n<think>\nsumo\n</think>\n\nEs")
