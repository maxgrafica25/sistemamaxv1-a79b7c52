-- Temporarily disable the trigger to update roles
ALTER TABLE profiles DISABLE TRIGGER prevent_role_escalation_trigger;

UPDATE profiles SET role = 'admin' WHERE display_name IN ('Juliano Michelin', 'Marcelle');

ALTER TABLE profiles ENABLE TRIGGER prevent_role_escalation_trigger;