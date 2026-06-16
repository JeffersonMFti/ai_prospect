from datetime import datetime

from scheduling import is_within_business_hours, next_business_time, should_follow_up


class TestBusinessHours:
    def test_dentro(self):
        assert is_within_business_hours(datetime(2026, 6, 15, 10), 9, 18) is True
        assert is_within_business_hours(datetime(2026, 6, 15, 9), 9, 18) is True

    def test_fora(self):
        assert is_within_business_hours(datetime(2026, 6, 15, 8), 9, 18) is False
        assert is_within_business_hours(datetime(2026, 6, 15, 18), 9, 18) is False
        assert is_within_business_hours(datetime(2026, 6, 15, 23), 9, 18) is False

    def test_next_dentro_retorna_proprio(self):
        dt = datetime(2026, 6, 15, 10, 30)
        assert next_business_time(dt, 9, 18) == dt

    def test_next_antes_vai_para_inicio_hoje(self):
        dt = datetime(2026, 6, 15, 7, 0)
        assert next_business_time(dt, 9, 18) == datetime(2026, 6, 15, 9, 0)

    def test_next_depois_vai_para_amanha(self):
        dt = datetime(2026, 6, 15, 20, 0)
        assert next_business_time(dt, 9, 18) == datetime(2026, 6, 16, 9, 0)


class TestFollowUp:
    def test_sem_contato_nao_faz(self):
        assert should_follow_up(None, 0, datetime(2026, 6, 15), 3, 2) is False

    def test_atingiu_maximo(self):
        last = datetime(2026, 6, 1)
        assert should_follow_up(last, 2, datetime(2026, 6, 15), 3, 2) is False

    def test_cedo_demais(self):
        last = datetime(2026, 6, 14)
        assert should_follow_up(last, 0, datetime(2026, 6, 15), 3, 2) is False

    def test_deve_fazer(self):
        last = datetime(2026, 6, 10)
        assert should_follow_up(last, 0, datetime(2026, 6, 15), 3, 2) is True
