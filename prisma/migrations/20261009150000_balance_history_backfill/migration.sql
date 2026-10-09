-- Backfill of the balance ledger: reconstructs past operations from already existing records
-- (paid top-ups, referral bonuses, solution write-offs, signup bonus).

INSERT INTO "balance_transactions"
    ("id", "user_id", "type", "amount", "balance_after", "description", "ref_id", "created_at")
WITH known_events AS (
    -- Paid top-ups
    SELECT p."user_id"                         AS "user_id",
           'payment'                           AS "type",
           cp."credits"                        AS "amount",
           'Пополнение: ' || cp."name"         AS "description",
           p."id"                              AS "ref_id",
           p."created_at"                      AS "created_at",
           1                                   AS "seq"
    FROM "payments" p
    JOIN "credit_packages" cp ON cp."id" = p."package_id"
    WHERE p."status" = 'paid'

    UNION ALL

    -- Referral bonuses
    SELECT r."referrer_id",
           'referral',
           r."reward",
           'Бонус за приглашённого друга',
           r."referred_user_id",
           r."created_at",
           1
    FROM "referrals" r

    UNION ALL

    -- Write-offs for solutions (1 credit per solved task)
    SELECT s."user_id",
           'solution',
           -1,
           NULL,
           s."id",
           s."created_at",
           1
    FROM "solutions" s
),
-- Signup bonus = current balance minus the sum of all known operations.
signup_events AS (
    SELECT u."id"                                        AS "user_id",
           'signup'                                      AS "type",
           u."balance" - COALESCE(SUM(e."amount"), 0)    AS "amount",
           'Стартовый бонус'                             AS "description",
           NULL                                          AS "ref_id",
           u."created_at"                                AS "created_at",
           0                                             AS "seq"
    FROM "users" u
    LEFT JOIN known_events e ON e."user_id" = u."id"
    GROUP BY u."id", u."balance", u."created_at"
    HAVING u."balance" - COALESCE(SUM(e."amount"), 0) > 0
),
all_events AS (
    SELECT * FROM known_events
    UNION ALL
    SELECT * FROM signup_events
)
SELECT gen_random_uuid()::text,
       "user_id",
       "type",
       "amount",
       SUM("amount") OVER (
           PARTITION BY "user_id"
           ORDER BY "created_at", "seq", "type"
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
       )::integer,
       "description",
       "ref_id",
       "created_at"
FROM all_events;
