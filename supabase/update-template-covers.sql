update public.templates
set cover_url = case id
  when '2d672f5b-cd1d-4a52-90e0-7cb1227119cc' then '/template-covers/healing-cover.png'
  when '8b2c63cc-e51b-4cc5-a479-ecff6a81c5b8' then '/template-covers/color-walk.png'
  when '90cfc826-8959-46bd-afe7-b42c2fb69aa5' then '/template-covers/plog.png'
  when '9df618c4-3977-4967-90e1-c2587ef10f37' then '/template-covers/doodle.png'
  when 'c7b28892-74de-49e5-bf31-bd1398c552f8' then '/template-covers/city-pop.png'
  when 'e405d0c7-091d-4516-b821-7567c84029cc' then '/template-covers/pop-art.png'
  when 'custom-image' then '/template-covers/custom.png'
  else cover_url
end
where id in (
  '2d672f5b-cd1d-4a52-90e0-7cb1227119cc',
  '8b2c63cc-e51b-4cc5-a479-ecff6a81c5b8',
  '90cfc826-8959-46bd-afe7-b42c2fb69aa5',
  '9df618c4-3977-4967-90e1-c2587ef10f37',
  'c7b28892-74de-49e5-bf31-bd1398c552f8',
  'e405d0c7-091d-4516-b821-7567c84029cc',
  'custom-image'
);
