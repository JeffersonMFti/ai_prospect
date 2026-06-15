from scraper import human_behavior as hb


def test_jitter_dentro_da_faixa():
    for _ in range(200):
        d = hb.jitter_ms(2000, 6000)
        assert 2000 <= d <= 6000


def test_jitter_corrige_ordem_invertida():
    for _ in range(50):
        d = hb.jitter_ms(6000, 2000)
        assert 2000 <= d <= 6000


def test_jitter_nao_negativo():
    for _ in range(50):
        assert hb.jitter_ms(-100, 100) >= 0
