update public.templates
set
  name = replace(name, '演算', ''),
  description = replace(description, '演算', ''),
  prompt = replace(prompt, '演算', '')
where id = '9df618c4-3977-4967-90e1-c2587ef10f37'
   or name like '%演算%'
   or description like '%演算%'
   or prompt like '%演算%';
