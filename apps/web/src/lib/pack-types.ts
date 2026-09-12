export const PACK_SLOTS = ["contents", "syllabus", "students"] as const;
export type PackSlot = (typeof PACK_SLOTS)[number];

export const LANGUAGES = [
  { id: "es", label: "Español" },
  { id: "ca", label: "Català" },
  { id: "gl", label: "Galego" },
  { id: "eu", label: "Euskera" },
  { id: "en", label: "English" },
  { id: "fr", label: "Français" },
] as const;

export type AdaptationId = "tdah" | "tea" | "altasCapacidades";

export type DriveBrowseItem = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  url: string | null;
  folder: boolean;
};

export type PackFile = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  url: string | null;
};

export function packFileFromBrowse(item: DriveBrowseItem): PackFile {
  return {
    id: item.id,
    name: item.name,
    size: item.size,
    mimeType: item.mimeType,
    url: item.url,
  };
}

export type TopicAdaptations = {
  tdah: boolean;
  tea: boolean;
  altasCapacidades: boolean;
};

export type CourseTopic = {
  id: string;
  title: string;
  language: string;
  adaptations: TopicAdaptations;
  notes: PackFile[];
  createdAt: number;
};

export type CoursePack = {
  courseId: string;
  contents: PackFile[];
  syllabus: PackFile[];
  students: PackFile[];
  topics: CourseTopic[];
};

export function packReady(pack: CoursePack) {
  return (
    pack.contents.length > 0 &&
    pack.syllabus.length > 0 &&
    pack.students.length > 0
  );
}

export function emptyPack(courseId: string): CoursePack {
  return {
    courseId,
    contents: [],
    syllabus: [],
    students: [],
    topics: [],
  };
}
