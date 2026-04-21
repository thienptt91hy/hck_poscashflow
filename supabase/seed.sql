-- =============================================================
-- Seed data — 4 stores
-- =============================================================
insert into public.stores (code, name_vi, name_ja, name_en, has_cafe_bakery, sort_order) values
  ('SETO',   'Seto',               '瀬戸店',            'Seto',           false, 1),
  ('KOMAKI', 'Komaki',             '小牧店',            'Komaki',         false, 2),
  ('KONAN',  'Konan',              '江南店',            'Konan',          true,  3),
  ('BANHMI', 'Quán Bánh mì',       'バインミー店',      'Banh Mi Shop',   false, 4)
on conflict (code) do nothing;

-- Sample fixed expenses (from requirements doc)
insert into public.fixed_expenses (name_vi, name_ja, amount, category) values
  ('Máy POS (card machine)', 'カード機',          4950,   'equipment'),
  ('Web hosting',             'Web',               5000,   'service'),
  ('Bảo hiểm + lương hưu',   '保険・年金',        871672, 'insurance'),
  ('Xe Hiace',                'ハイエース',         51400,  'vehicle'),
  ('Bảo hiểm xe',             '自動車保険',         14860,  'insurance'),
  ('Thuế',                    '税金',               33000,  'tax')
on conflict do nothing;
