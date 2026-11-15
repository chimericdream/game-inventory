-- Data repair. BGG text used to be stored with HTML entities left in it ("Children&#039;s Game",
-- "&ldquo;squished&rdquo;"). The lookup now decodes them; this decodes what is already stored.
-- BGG escapes with PHP's htmlentities, so numeric references plus the HTML 4.01 names cover it.
-- Only a complete reference ending in ";" is touched, and an unknown one is left as written.
CREATE OR REPLACE FUNCTION pg_temp.decode_html_entities(src text) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  names constant jsonb := '{
    "quot": "\"",
    "amp": "&",
    "lt": "<",
    "gt": ">",
    "apos": "''",
    "nbsp": " ",
    "iexcl": "¡",
    "cent": "¢",
    "pound": "£",
    "curren": "¤",
    "yen": "¥",
    "brvbar": "¦",
    "sect": "§",
    "uml": "¨",
    "copy": "©",
    "ordf": "ª",
    "laquo": "«",
    "not": "¬",
    "shy": "­",
    "reg": "®",
    "macr": "¯",
    "deg": "°",
    "plusmn": "±",
    "sup2": "²",
    "sup3": "³",
    "acute": "´",
    "micro": "µ",
    "para": "¶",
    "middot": "·",
    "cedil": "¸",
    "sup1": "¹",
    "ordm": "º",
    "raquo": "»",
    "frac14": "¼",
    "frac12": "½",
    "frac34": "¾",
    "iquest": "¿",
    "Agrave": "À",
    "Aacute": "Á",
    "Acirc": "Â",
    "Atilde": "Ã",
    "Auml": "Ä",
    "Aring": "Å",
    "AElig": "Æ",
    "Ccedil": "Ç",
    "Egrave": "È",
    "Eacute": "É",
    "Ecirc": "Ê",
    "Euml": "Ë",
    "Igrave": "Ì",
    "Iacute": "Í",
    "Icirc": "Î",
    "Iuml": "Ï",
    "ETH": "Ð",
    "Ntilde": "Ñ",
    "Ograve": "Ò",
    "Oacute": "Ó",
    "Ocirc": "Ô",
    "Otilde": "Õ",
    "Ouml": "Ö",
    "times": "×",
    "Oslash": "Ø",
    "Ugrave": "Ù",
    "Uacute": "Ú",
    "Ucirc": "Û",
    "Uuml": "Ü",
    "Yacute": "Ý",
    "THORN": "Þ",
    "szlig": "ß",
    "agrave": "à",
    "aacute": "á",
    "acirc": "â",
    "atilde": "ã",
    "auml": "ä",
    "aring": "å",
    "aelig": "æ",
    "ccedil": "ç",
    "egrave": "è",
    "eacute": "é",
    "ecirc": "ê",
    "euml": "ë",
    "igrave": "ì",
    "iacute": "í",
    "icirc": "î",
    "iuml": "ï",
    "eth": "ð",
    "ntilde": "ñ",
    "ograve": "ò",
    "oacute": "ó",
    "ocirc": "ô",
    "otilde": "õ",
    "ouml": "ö",
    "divide": "÷",
    "oslash": "ø",
    "ugrave": "ù",
    "uacute": "ú",
    "ucirc": "û",
    "uuml": "ü",
    "yacute": "ý",
    "thorn": "þ",
    "yuml": "ÿ",
    "OElig": "Œ",
    "oelig": "œ",
    "Scaron": "Š",
    "scaron": "š",
    "Yuml": "Ÿ",
    "fnof": "ƒ",
    "circ": "ˆ",
    "tilde": "˜",
    "Alpha": "Α",
    "Beta": "Β",
    "Gamma": "Γ",
    "Delta": "Δ",
    "Epsilon": "Ε",
    "Zeta": "Ζ",
    "Eta": "Η",
    "Theta": "Θ",
    "Iota": "Ι",
    "Kappa": "Κ",
    "Lambda": "Λ",
    "Mu": "Μ",
    "Nu": "Ν",
    "Xi": "Ξ",
    "Omicron": "Ο",
    "Pi": "Π",
    "Rho": "Ρ",
    "Sigma": "Σ",
    "Tau": "Τ",
    "Upsilon": "Υ",
    "Phi": "Φ",
    "Chi": "Χ",
    "Psi": "Ψ",
    "Omega": "Ω",
    "alpha": "α",
    "beta": "β",
    "gamma": "γ",
    "delta": "δ",
    "epsilon": "ε",
    "zeta": "ζ",
    "eta": "η",
    "theta": "θ",
    "iota": "ι",
    "kappa": "κ",
    "lambda": "λ",
    "mu": "μ",
    "nu": "ν",
    "xi": "ξ",
    "omicron": "ο",
    "pi": "π",
    "rho": "ρ",
    "sigmaf": "ς",
    "sigma": "σ",
    "tau": "τ",
    "upsilon": "υ",
    "phi": "φ",
    "chi": "χ",
    "psi": "ψ",
    "omega": "ω",
    "thetasym": "ϑ",
    "upsih": "ϒ",
    "piv": "ϖ",
    "ensp": " ",
    "emsp": " ",
    "thinsp": " ",
    "zwnj": "‌",
    "zwj": "‍",
    "lrm": "‎",
    "rlm": "‏",
    "ndash": "–",
    "mdash": "—",
    "lsquo": "‘",
    "rsquo": "’",
    "sbquo": "‚",
    "ldquo": "“",
    "rdquo": "”",
    "bdquo": "„",
    "dagger": "†",
    "Dagger": "‡",
    "bull": "•",
    "hellip": "…",
    "permil": "‰",
    "prime": "′",
    "Prime": "″",
    "lsaquo": "‹",
    "rsaquo": "›",
    "oline": "‾",
    "frasl": "⁄",
    "euro": "€",
    "image": "ℑ",
    "weierp": "℘",
    "real": "ℜ",
    "trade": "™",
    "alefsym": "ℵ",
    "larr": "←",
    "uarr": "↑",
    "rarr": "→",
    "darr": "↓",
    "harr": "↔",
    "crarr": "↵",
    "lArr": "⇐",
    "uArr": "⇑",
    "rArr": "⇒",
    "dArr": "⇓",
    "hArr": "⇔",
    "forall": "∀",
    "part": "∂",
    "exist": "∃",
    "empty": "∅",
    "nabla": "∇",
    "isin": "∈",
    "notin": "∉",
    "ni": "∋",
    "prod": "∏",
    "sum": "∑",
    "minus": "−",
    "lowast": "∗",
    "radic": "√",
    "prop": "∝",
    "infin": "∞",
    "ang": "∠",
    "and": "∧",
    "or": "∨",
    "cap": "∩",
    "cup": "∪",
    "int": "∫",
    "there4": "∴",
    "sim": "∼",
    "cong": "≅",
    "asymp": "≈",
    "ne": "≠",
    "equiv": "≡",
    "le": "≤",
    "ge": "≥",
    "sub": "⊂",
    "sup": "⊃",
    "nsub": "⊄",
    "sube": "⊆",
    "supe": "⊇",
    "oplus": "⊕",
    "otimes": "⊗",
    "perp": "⊥",
    "sdot": "⋅",
    "lceil": "⌈",
    "rceil": "⌉",
    "lfloor": "⌊",
    "rfloor": "⌋",
    "lang": "⟨",
    "rang": "⟩",
    "loz": "◊",
    "spades": "♠",
    "clubs": "♣",
    "hearts": "♥",
    "diams": "♦"
  }';
  result text := '';
  rest text := src;
  pos int;
  m text[];
  code int;
  rep text;
BEGIN
  IF src IS NULL THEN
    RETURN NULL;
  END IF;
  LOOP
    pos := strpos(rest, '&');
    EXIT WHEN pos = 0;
    result := result || left(rest, pos - 1);
    rest := substr(rest, pos);
    m := regexp_match(rest, '^(&(?:#([0-9]{1,7})|#[xX]([0-9a-fA-F]{1,6})|([A-Za-z][A-Za-z0-9]{0,31}));)');
    rep := NULL;
    IF m IS NOT NULL THEN
      code := NULL;
      IF m[2] IS NOT NULL THEN
        code := m[2]::int;
      ELSIF m[3] IS NOT NULL THEN
        code := ('x' || lpad(m[3], 8, '0'))::bit(32)::int;
      ELSE
        rep := names ->> m[4];
      END IF;
      -- Printable code points only: no NUL, other controls, C1 range or surrogates.
      IF code IN (9, 10, 13) OR code BETWEEN 32 AND 126
        OR (code BETWEEN 160 AND 1114111 AND code NOT BETWEEN 55296 AND 57343) THEN
        rep := chr(code);
      END IF;
    END IF;
    IF rep IS NULL THEN
      result := result || '&';
      rest := substr(rest, 2);
    ELSE
      result := result || rep;
      rest := substr(rest, length(m[1]) + 1);
    END IF;
  END LOOP;
  RETURN result || rest;
END
$$;
--> statement-breakpoint
UPDATE "games" SET
  "title" = pg_temp.decode_html_entities("title"),
  "description" = pg_temp.decode_html_entities("description"),
  "publisher" = pg_temp.decode_html_entities("publisher")
WHERE "title" LIKE '%&%;%' OR "description" LIKE '%&%;%' OR "publisher" LIKE '%&%;%';
--> statement-breakpoint
-- Tags match case-insensitively by name, so a decoded tag can collide with one that already has the
-- clean name ("Children's Game" typed by hand). Each colliding group keeps one tag, preferring a
-- name that was already clean, and its games move onto that tag.
CREATE TEMP TABLE "tag_decode" ON COMMIT DROP AS
SELECT "id", "household_id", "name", pg_temp.decode_html_entities("name") AS "decoded" FROM "tags";
--> statement-breakpoint
CREATE TEMP TABLE "tag_keep" ON COMMIT DROP AS
SELECT DISTINCT ON ("household_id", lower("decoded"))
  "household_id", lower("decoded") AS "key", "id" AS "keep_id", "decoded"
FROM "tag_decode"
ORDER BY "household_id", lower("decoded"), ("name" <> "decoded"), "id";
--> statement-breakpoint
CREATE TEMP TABLE "tag_merge" ON COMMIT DROP AS
SELECT d."id" AS "tag_id", k."keep_id"
FROM "tag_decode" d
JOIN "tag_keep" k ON k."household_id" = d."household_id" AND k."key" = lower(d."decoded")
WHERE d."id" <> k."keep_id"
  AND EXISTS (
    SELECT 1 FROM "tag_decode" c
    WHERE c."household_id" = d."household_id" AND lower(c."decoded") = lower(d."decoded")
      AND c."name" <> c."decoded"
  );
--> statement-breakpoint
INSERT INTO "game_tags" ("household_id", "game_id", "tag_id")
SELECT gt."household_id", gt."game_id", m."keep_id"
FROM "game_tags" gt JOIN "tag_merge" m ON m."tag_id" = gt."tag_id"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
DELETE FROM "tags" WHERE "id" IN (SELECT "tag_id" FROM "tag_merge");
--> statement-breakpoint
UPDATE "tags" t SET "name" = k."decoded"
FROM "tag_keep" k
WHERE t."id" = k."keep_id" AND t."name" <> k."decoded";
--> statement-breakpoint
-- Guest links hide games by tag name; keep those rules pointing at the renamed tags.
UPDATE "share_links" SET "hide_tags" = ARRAY(
  SELECT pg_temp.decode_html_entities(t) FROM unnest("hide_tags") WITH ORDINALITY AS u(t, i) ORDER BY i
)
WHERE array_to_string("hide_tags", ' ') LIKE '%&%;%';
--> statement-breakpoint
DROP FUNCTION pg_temp.decode_html_entities(text);
