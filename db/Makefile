.PHONY: migrate seed reset

migrate:
	python3 migrate.py

seed:
	python3 seed.py

reset:
	python3 -c "from db import connect, ensure_database; \
ensure_database(); conn = connect(); conn.autocommit = True; \
conn.execute('DROP SCHEMA public CASCADE'); conn.execute('CREATE SCHEMA public')"
	$(MAKE) migrate
	$(MAKE) seed
