-- Enable Row Level Security for the main tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

-- Default every new user to the staff role unless promoted to admin
ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'staff';
UPDATE public.users SET role = COALESCE(role, 'staff') WHERE role IS NULL;

-- Revoke direct access from the public role
REVOKE ALL ON public.users FROM PUBLIC;
REVOKE ALL ON public.rooms FROM PUBLIC;
REVOKE ALL ON public.bookings FROM PUBLIC;
REVOKE ALL ON public.checkins FROM PUBLIC;

-- users: allow users to manage their own profile and admins to manage any profile
CREATE POLICY "Users can manage own profile" ON public.users
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can manage users" ON public.users
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'
  ));

-- rooms: only authenticated users can read, only admins can insert/update/delete
CREATE POLICY "Authenticated can select rooms" ON public.rooms
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage rooms" ON public.rooms
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'
  ));

-- bookings: owners and admins can read, owners can insert their own bookings, owners/admins can update or delete
CREATE POLICY "Users can select own bookings" ON public.bookings
  FOR SELECT
  USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

CREATE POLICY "Users can insert own bookings" ON public.bookings
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners or admins can update bookings" ON public.bookings
  FOR UPDATE
  USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  )
  WITH CHECK (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

CREATE POLICY "Owners or admins can delete bookings" ON public.bookings
  FOR DELETE
  USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- checkins: owners can read and insert own checkins, admins can manage all
CREATE POLICY "Users can select own checkins" ON public.checkins
  FOR SELECT
  USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

CREATE POLICY "Users can insert own checkins" ON public.checkins
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage checkins" ON public.checkins
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'
  ));
