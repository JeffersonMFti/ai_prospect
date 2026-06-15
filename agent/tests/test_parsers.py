from scraper import parsers


class TestNormalizePhone:
    def test_formatos_comuns_br(self):
        assert parsers.normalize_phone_br("(85) 99999-9999") == "5585999999999"
        assert parsers.normalize_phone_br("+55 85 99999-9999") == "5585999999999"
        assert parsers.normalize_phone_br("8533334444") == "558533334444"
        assert parsers.normalize_phone_br("55 85 3333-4444") == "558533334444"

    def test_invalidos(self):
        assert parsers.normalize_phone_br(None) is None
        assert parsers.normalize_phone_br("") is None
        assert parsers.normalize_phone_br("123") is None
        assert parsers.normalize_phone_br("abc") is None
        # DDD inválido (00)
        assert parsers.normalize_phone_br("00 99999-9999") is None


class TestClassifyWebsite:
    def test_sem_url_eh_lead_valido(self):
        r = parsers.classify_website(None)
        assert r["has_website"] is False and r["has_instagram"] is False

    def test_instagram_marca_e_continua_lead(self):
        r = parsers.classify_website("https://instagram.com/clinica")
        assert r["has_website"] is False
        assert r["has_instagram"] is True
        assert "instagram.com" in r["instagram_url"]

    def test_facebook_linktree_nao_eh_site_de_verdade(self):
        assert parsers.classify_website("https://facebook.com/loja")["has_website"] is False
        assert parsers.classify_website("https://linktr.ee/loja")["has_website"] is False

    def test_site_de_verdade_descarta(self):
        assert parsers.classify_website("https://clinicabella.com.br")["has_website"] is True


class TestReviewsRating:
    def test_reviews(self):
        assert parsers.parse_reviews("(1.234)") == 1234
        assert parsers.parse_reviews("340 avaliações") == 340
        assert parsers.parse_reviews("12") == 12
        assert parsers.parse_reviews(None) is None
        assert parsers.parse_reviews("sem número") is None

    def test_rating(self):
        assert parsers.parse_rating("4,8") == 4.8
        assert parsers.parse_rating("4.8 estrelas") == 4.8
        assert parsers.parse_rating("5") == 5.0
        assert parsers.parse_rating("9,9") is None  # fora de 0..5
        assert parsers.parse_rating(None) is None
