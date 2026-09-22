-- Remove saves and recommendations that people left on their own listings.
--
-- Saves and recommends exist to tell a visitor what OTHER panas think of a
-- business. They are the only social proof on the profile page, so the one
-- party with something to gain from a higher number is the one party who
-- must not be able to raise it.
--
-- The application now refuses these on write, and the profile page stops
-- rendering the buttons on a listing you administer. That leaves anything
-- recorded before the rule existed, which would be doubly wrong: it inflates
-- the count, and with the buttons gone the owner has no way to take it back
-- even if they wanted to. So it is cleared here rather than left to sit.
--
-- Recommends also carry a face into the recommender row on the profile, so a
-- stale self-recommend would keep showing the owner among the people
-- vouching for them.
--
-- Scoped to owners specifically -- a join against profile_owners -- so an
-- ordinary pana who saved a business they have no stake in keeps their save.

DELETE FROM profile_signals ps
USING profile_owners po
WHERE po.profile_id = ps.profile_id
  AND po.user_id = ps.user_id;
