-- ==============================================================================
-- 018_projects_table.sql
-- Puravankara Projects & Communities Master Catalog
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.projects (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    location VARCHAR(255) NOT NULL,
    image VARCHAR(500) NOT NULL,
    status VARCHAR(100) DEFAULT 'Ongoing',
    type VARCHAR(100) DEFAULT 'Residential',
    rera_number VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Allow public read access (residents, visitors, and admins need to view projects)
DROP POLICY IF EXISTS "Allow public read access on projects" ON public.projects;
CREATE POLICY "Allow public read access on projects"
    ON public.projects FOR SELECT
    USING (true);

-- Allow authenticated admins to insert/update projects
DROP POLICY IF EXISTS "Allow admins to modify projects" ON public.projects;
CREATE POLICY "Allow admins to modify projects"
    ON public.projects FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.user_id = auth.uid()
              AND users.role IN ('admin', 'super_admin')
        )
    );

-- Seed Initial Projects Data
INSERT INTO public.projects (id, name, city, location, image, status, type)
VALUES
    ('purva-heritage', 'Purva Heritage', 'Bengaluru', 'Kudlu Gate, Bengaluru', '/purva_heritage.jpg', 'Newly Launched', 'Residential'),
    ('northern-lights', 'Northern Lights by Puravankara | KVN', 'Bengaluru', 'KIADB, Aerospace Park, Bengaluru', '/purva_complex.jpg', 'Newly Launched', 'Residential'),
    ('purva-silversky', 'Purva Silversky', 'Bengaluru', 'Electronic City, Bengaluru', '/purva_complex.jpg', 'Newly Launched', 'Residential'),
    ('purva-blubelle', 'Purva Blubelle', 'Bengaluru', 'Magadi Road, Bengaluru', '/purva_heritage.jpg', 'Ongoing', 'Residential'),
    ('purva-orient-grand', 'Purva Orient Grand', 'Bengaluru', 'Lalbagh Road, Bengaluru', '/purva_heritage.jpg', 'Ongoing', 'Luxury Residential'),
    ('purva-atmosphere', 'Purva Atmosphere', 'Bengaluru', 'Thanisandra Road, Bengaluru', '/purva_complex.jpg', 'Ongoing', 'Residential'),
    ('bengaluru-corporate', 'Bengaluru Corporate Head Office', 'Bengaluru', 'Ulsoor Road, Bengaluru', '/puravankara_building.png', 'Headquarters', 'Corporate Operations'),
    ('purva-somerset', 'Purva Somerset House', 'Chennai', 'Guindy, Chennai', '/purva_heritage.jpg', 'Ongoing', 'Luxury Residential'),
    ('purva-windermere', 'Purva Windermere', 'Chennai', 'Pallikaranai, Chennai', '/purva_complex.jpg', 'Completed / Handover', 'Residential'),
    ('purva-clermont', 'Purva Clermont', 'Mumbai', 'Chembur, Mumbai', '/purva_complex.jpg', 'Newly Launched', 'Residential'),
    ('purva-silversands', 'Purva Silversands', 'Pune', 'Mundhwa, Pune', '/purva_heritage.jpg', 'Ongoing', 'Residential'),
    ('purva-summit', 'Purva Summit', 'Hyderabad', 'HITEC City, Hyderabad', '/purva_complex.jpg', 'Commercial & Tech', 'Commercial'),
    ('purva-grandbay', 'Purva GrandBay', 'Kochi', 'Marine Drive, Kochi', '/purva_bengaluru_balcony.jpg', 'Completed', 'Luxury Waterfront'),
    ('purva-amaiti', 'Purva Amaiti', 'Coimbatore', 'Singanallur, Coimbatore', '/purva_complex.jpg', 'Ongoing', 'Residential')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    city = EXCLUDED.city,
    location = EXCLUDED.location,
    image = EXCLUDED.image,
    status = EXCLUDED.status,
    type = EXCLUDED.type,
    updated_at = NOW();
