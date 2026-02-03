CREATE TABLE "radar_frames" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"frame_time" integer NOT NULL,
	"path" text NOT NULL,
	"tile_url" text NOT NULL,
	"cached_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "radar_frames_frame_time_unique" UNIQUE("frame_time")
);
