-- Seed plans for a live deployment.
--
-- Run this AFTER schema.sql, once. Without it a fresh deployment opens to an
-- empty feed, and an empty feed is a dead app: nobody posts the first plan into
-- a void. These fifteen are the Houston set the demo uses, with plausible proof
-- counts so the ranking has something to work with on day one.
--
-- created_by is null on purpose: these belong to nobody, so nobody can edit or
-- delete them, and they read as "the house set" rather than one person's cards.
--
-- Swap them for your own city before you launch anywhere else. A plan nobody in
-- the area recognises is worse than no plan.

insert into plans (title, steps, area, vibe, cost_per_person, hours, best_time, tips, done_count, last_done_at) values

('Hot pot then karaoke',
 array['Hot pot at Tan Tan', 'Karaoke at KBox until 1am'],
 'Houston · Chinatown', array['food', 'late night'], 35, 4, 'Fri/Sat night',
 array['Put your name down at KBox before you sit down to eat, the wait is an hour after 9',
       'Split one large broth, two is too much for four people'],
 14, now() - interval '1 day'),

('Sunday pickleball + boba',
 array['Pickleball at Memorial Park courts', 'Boba at Teahouse'],
 'Houston · Memorial', array['sport', 'chill'], 8, 3, 'Sun morning',
 array['Courts are free but full after 10am, get there by 8:30', 'Bring your own paddle, nobody lends'],
 9, now() - interval '2 days'),

('Night market crawl',
 array['Viet Hoa parking lot night market', 'Late bánh mì run'],
 'Houston · Bellaire', array['food', 'walk'], 20, 3, 'Sat night',
 array['Cash only at most stalls', 'Park on the street, the lot fills by 7'],
 22, now()),

('Board game cafe war',
 array['Tea + Victory board game cafe', 'Loser buys ramen'],
 'Houston · Midtown', array['games', 'chill'], 25, 4, 'Weeknight',
 array['There is a table fee per person, drinks are extra',
       'Ask staff to teach you one game, it saves 30 minutes of rules'],
 11, now() - interval '3 days'),

('Sunrise at the beach',
 array['Leave 4:30am for Galveston', 'Sunrise on the seawall', 'Breakfast tacos on the way back'],
 'Galveston', array['outdoors', 'road trip'], 15, 6, 'Sat',
 array['Split gas, it is about an hour each way', 'Bring a blanket, it is cold before sunrise even in summer'],
 6, now() - interval '5 days'),

('Kolache + museum day',
 array['Kolache Factory', 'Free day at MFAH', 'Hermann Park walk'],
 'Houston · Museum District', array['chill', 'walk'], 12, 5, 'Thu (free museum day)',
 array['MFAH is free on Thursdays, check the hours first', 'Park at the garage, street parking is a trap'],
 8, now() - interval '4 days'),

('Bowling + Whataburger',
 array['Bowling at Palace Lanes', 'Whataburger at midnight'],
 'Houston · Bellaire', array['games', 'late night'], 22, 3, 'Fri night',
 array['Shoe rental is extra, wear socks', 'Two games per lane is the sweet spot'],
 17, now() - interval '1 day'),

('Cook-off at someone''s place',
 array['Everyone brings one dish', 'Blind taste ranking', 'Mario Kart after'],
 'Anywhere', array['food', 'home'], 10, 4, 'Sat night',
 array['Assign categories or you get four desserts', 'Host does not cook, host does dishes'],
 13, now() - interval '2 days'),

('Thrift then rooftop',
 array['Thrift crawl on Westheimer', 'Rooftop drinks at sunset'],
 'Houston · Montrose', array['walk', 'drinks'], 40, 4, 'Sat afternoon',
 array['Start at the far end and walk back toward the car', 'Rooftops get a line at sunset, go 30 minutes early'],
 10, now() - interval '6 days'),

('Trail run + acai',
 array['Buffalo Bayou loop', 'Acai bowls after'],
 'Houston · Buffalo Bayou', array['sport', 'outdoors'], 10, 2, 'Sun morning',
 array['The loop is about 3 miles, walkable if someone is not a runner',
       'Water fountains are only at the park end'],
 7, now() - interval '2 days'),

('Rockets game on a budget',
 array['Cheap upper deck tickets', 'Tacos at Tacos A Go Go after'],
 'Houston · Downtown', array['sport', 'food'], 45, 4, 'Game night',
 array['Buy resale the morning of, prices drop', 'Park a few blocks out and walk, garage parking doubles the cost'],
 5, now() - interval '9 days'),

('Study session that turns into dinner',
 array['UH library 3rd floor', 'Pho at 8pm'],
 'Houston · UH', array['chill', 'food'], 14, 5, 'Weeknight',
 array['3rd floor is quiet, 2nd floor is not', 'Book a group room a day ahead'],
 19, now()),

('Escape room then bubble waffles',
 array['Escape room in Chinatown', 'Bubble waffles at Snow Bear'],
 'Houston · Chinatown', array['games', 'food'], 38, 3, 'Fri night',
 array['Book online, walk-ins get the bad room', 'Four people is the right size, six is chaos'],
 12, now() - interval '3 days'),

('Late night drive + gas station snacks',
 array['Drive with no destination', 'Buc-ee''s at 1am'],
 'Anywhere', array['late night', 'road trip'], 12, 3, 'Any night',
 array['Make the playlist before you leave', 'Buc-ee''s brisket is the move, not the pastries'],
 21, now() - interval '1 day'),

('Volleyball at the park',
 array['Bring a net to Discovery Green', 'Paletas after'],
 'Houston · Downtown', array['sport', 'outdoors'], 5, 3, 'Sat afternoon',
 array['One person has to own a net, borrow from a rec center', 'Shade is gone after 2pm in summer'],
 8, now() - interval '7 days');
