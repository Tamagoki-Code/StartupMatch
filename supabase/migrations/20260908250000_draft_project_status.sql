-- "Save as Draft" in Post a Project previously only flipped a local button
-- label (setSaved(true)) and never wrote anything anywhere, so a saved
-- draft could never show up again. Adding a real status lets a draft be
-- inserted and later listed/published/deleted like any other row.
alter type marketplace_status add value if not exists 'Draft';
