# Sermon Inline Video Management Porting Guide

This note is for moving the Joyful Church sermon/video management pattern into
another church homepage project without requiring ordinary video managers to
enter the full admin dashboard.

## Goal

- Visitors can only watch videos.
- Approved video managers can add, edit, delete, hide/show, and reorder videos
  directly on the public video page.
- Reordering should use drag and drop.
- Server-side permission checks remain required for every write request.
- The UI should stay close to the existing church page style.

## Reference Files In This Project

Use these files as the first reference points:

```txt
client/src/pages/YoutubeListPage.tsx
client/src/components/YoutubeEditPanel.tsx
server/routers/youtube.ts
server/db/youtube.ts
drizzle/schema.ts
shared/adminPermissions.ts
client/src/lib/contentPermissions.ts
```

The current database tables are:

```txt
youtube_playlists
youtube_videos
```

For another project, either keep these names or rename them consistently, for
example:

```txt
sermon_video_playlists
sermon_videos
```

## Minimal Data Shape

```ts
type SermonVideo = {
  id: number;
  playlistId: number;
  videoId: string | null;
  videoUrl: string | null;
  title: string;
  preacher: string | null;
  scripture: string | null;
  sermonDate: string | null;
  thumbnailUrl: string | null;
  description: string | null;
  sortOrder: number;
  isVisible: boolean;
};
```

## Suggested SQL Shape

```sql
CREATE TABLE sermon_video_playlists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(128) NOT NULL,
  description TEXT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE sermon_videos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  playlistId INT NOT NULL,
  videoId VARCHAR(32) NULL,
  videoUrl TEXT NULL,
  title VARCHAR(256) NOT NULL,
  preacher VARCHAR(128) NULL,
  scripture VARCHAR(256) NULL,
  sermonDate VARCHAR(32) NULL,
  thumbnailUrl TEXT NULL,
  description TEXT NULL,
  sortOrder INT NOT NULL DEFAULT 0,
  isVisible BOOLEAN NOT NULL DEFAULT TRUE,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  INDEX idx_sermon_videos_playlist_sort (playlistId, sortOrder, id)
);
```

## API Contract

The exact router can be REST or tRPC, but keep these operations:

```txt
GET    /api/sermon-videos?playlistId=1
POST   /api/sermon-videos
PATCH  /api/sermon-videos/:id
DELETE /api/sermon-videos/:id
POST   /api/sermon-videos/reorder
```

Every write route must require a video-management permission. A typical
permission check is:

```ts
function canManageVideos(user: User | null) {
  return Boolean(
    user?.role === "admin" ||
    user?.permissions?.includes("content:youtube") ||
    user?.permissions?.includes("content:sermon")
  );
}
```

## Frontend Pattern

Use a public video page with an inline edit panel:

- Show the management button only when `canManageVideos` is true.
- Keep video creation, editing, and deleting inside the same page.
- Use `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities` for
  drag-and-drop order changes.
- Persist order by sending the ordered video IDs to the reorder endpoint.
- After saving, refresh the playlist data without navigating away.

Recommended packages:

```bash
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities lucide-react
```

## UI Behavior Checklist

- Add video button appears only for authorized users.
- Add form supports YouTube URL or video ID.
- Edit form supports title, preacher, scripture, date, thumbnail, description,
  visibility, and playlist/category if needed.
- Delete asks for confirmation.
- Drag reorder saves to the server and survives refresh.
- Unauthorized users cannot see edit controls and cannot call write APIs.

## Handoff Notes

When porting to another codebase, copy the behavior rather than blindly copying
file paths. The most important pieces are the table shape, permission check,
inline edit panel, and reorder endpoint.
