update public.templates
set cost = case id
  when '8b2c63cc-e51b-4cc5-a479-ecff6a81c5b8' then 25
  when '9df618c4-3977-4967-90e1-c2587ef10f37' then 35
  when 'c7b28892-74de-49e5-bf31-bd1398c552f8' then 25
  when 'custom-image' then 30
  else cost
end
where id in (
  '8b2c63cc-e51b-4cc5-a479-ecff6a81c5b8',
  '9df618c4-3977-4967-90e1-c2587ef10f37',
  'c7b28892-74de-49e5-bf31-bd1398c552f8',
  'custom-image'
);
