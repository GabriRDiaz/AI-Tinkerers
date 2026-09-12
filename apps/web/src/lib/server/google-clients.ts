import { google, type classroom_v1, type drive_v3 } from "googleapis";
import { DomainError } from "./domain-error";
import { createOAuthClient } from "./google-oauth";
import type { GoogleSession } from "./google-session";
import type {
  ClassroomAssignment,
  ClassroomCourse,
  DriveDoc,
} from "../classroom-types";
import type { DriveBrowseItem } from "../pack-types";

export interface ClassroomReader {
  listCourses(): Promise<ClassroomCourse[]>;
  listCourseWork(courseId: string): Promise<ClassroomAssignment[]>;
}

export type { DriveBrowseItem };

export interface DriveDocs {
  identity(): Promise<{ email: string; name: string }>;
  list(courseId: string): Promise<DriveDoc[]>;
  browse(
    folderId?: string,
    pageToken?: string,
    options?: { query?: string; shared?: boolean },
  ): Promise<{ files: DriveBrowseItem[]; nextPageToken: string | null }>;
  inspect(id: string): Promise<DriveBrowseItem>;
  get(id: string): Promise<DriveDoc>;
  create(
    input: {
      title: string;
      description: string;
      details: string;
      courseId: string;
      courseWorkId?: string | null;
    },
    beforeWrite: () => Promise<void>,
  ): Promise<DriveDoc>;
}

function formatDueDate(
  dueDate?: classroom_v1.Schema$Date | null,
  dueTime?: classroom_v1.Schema$TimeOfDay | null,
) {
  if (!dueDate?.year || !dueDate.month || !dueDate.day) return null;
  const yyyy = String(dueDate.year).padStart(4, "0");
  const mm = String(dueDate.month).padStart(2, "0");
  const dd = String(dueDate.day).padStart(2, "0");
  if (dueTime?.hours == null) return `${yyyy}-${mm}-${dd}`;
  const hh = String(dueTime.hours).padStart(2, "0");
  const min = String(dueTime.minutes ?? 0).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}Z`;
}

function classroomFailure() {
  return new DomainError(
    "Unable to read Google Classroom. Confirm the APIs are enabled, the signed-in account has courses, and the granted scopes include Classroom.",
  );
}

function driveFailure() {
  return new DomainError(
    "Unable to reach Google Drive. Confirm the Drive API is enabled and this app has drive.readonly access.",
  );
}

function safeDriveUrl(url: string | null | undefined) {
  if (!url) return null;
  try {
    const link = new URL(url);
    if (
      link.protocol !== "https:" ||
      link.username ||
      link.password ||
      !["docs.google.com", "drive.google.com"].includes(link.hostname)
    ) {
      throw new DomainError("Drive returned an unsafe file link.");
    }
    return link.toString();
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError("Drive returned an unsafe file link.");
  }
}

function asDoc(file: drive_v3.Schema$File, fallbackCourseId?: string): DriveDoc {
  const id = file.id?.trim();
  const title = file.name?.trim();
  if (!id || !title) throw new DomainError("Drive returned an invalid file record.");
  return {
    id,
    title,
    description: file.description ?? "",
    url: safeDriveUrl(file.webViewLink),
    courseId: file.appProperties?.classroomCourseId || fallbackCourseId || "",
  };
}

export class GoogleClassroomReader implements ClassroomReader {
  constructor(private classroom: classroom_v1.Classroom) {}

  async listCourses() {
    try {
      const courses: ClassroomCourse[] = [];
      let pageToken: string | undefined;
      do {
        const { data } = await this.classroom.courses.list({
          courseStates: ["ACTIVE"],
          pageSize: 50,
          pageToken,
        });
        for (const course of data.courses ?? []) {
          if (!course.id || !course.name) continue;
          courses.push({
            id: course.id,
            name: course.name,
            section: course.section ?? null,
            descriptionHeading: course.descriptionHeading ?? null,
            room: course.room ?? null,
            courseState: course.courseState ?? null,
            alternateLink: course.alternateLink ?? null,
          });
        }
        pageToken = data.nextPageToken ?? undefined;
      } while (pageToken && courses.length < 200);
      return courses;
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw classroomFailure();
    }
  }

  async listCourseWork(courseId: string) {
    try {
      const assignments: ClassroomAssignment[] = [];
      let pageToken: string | undefined;
      do {
        const { data } = await this.classroom.courses.courseWork.list({
          courseId,
          pageSize: 50,
          pageToken,
          orderBy: "dueDate desc",
        });
        for (const item of data.courseWork ?? []) {
          if (!item.id || !item.title) continue;
          assignments.push({
            id: item.id,
            title: item.title,
            description: item.description ?? null,
            state: item.state ?? null,
            dueDate: formatDueDate(item.dueDate, item.dueTime),
            workType: item.workType ?? null,
            alternateLink: item.alternateLink ?? null,
          });
        }
        pageToken = data.nextPageToken ?? undefined;
      } while (pageToken && assignments.length < 200);
      return assignments;
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw classroomFailure();
    }
  }
}

export class GoogleDriveDocs implements DriveDocs {
  constructor(
    private drive: drive_v3.Drive,
    private user: { email: string; name: string },
  ) {}

  async identity() {
    return this.user;
  }

  async browse(
    folderId = "root",
    pageToken?: string,
    options?: { query?: string; shared?: boolean },
  ) {
    try {
      const filters = ["trashed=false"];
      const query = options?.query?.trim();
      if (query) {
        filters.push(`name contains '${query.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`);
      } else if (options?.shared) {
        filters.push("sharedWithMe = true");
      } else {
        filters.push(`'${folderId.replaceAll("'", "\\'")}' in parents`);
      }
      const { data } = await this.drive.files.list({
        q: filters.join(" and "),
        fields: "nextPageToken, files(id,name,mimeType,size,webViewLink)",
        pageSize: 50,
        pageToken,
        orderBy: query || options?.shared ? "modifiedTime desc" : "folder,name",
        spaces: "drive",
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      const files: DriveBrowseItem[] = [];
      for (const file of data.files ?? []) {
        if (!file.id || !file.name) continue;
        files.push({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType || "application/octet-stream",
          size: Number(file.size ?? 0),
          url: safeDriveUrl(file.webViewLink),
          folder:
            file.mimeType === "application/vnd.google-apps.folder",
        });
      }
      return { files, nextPageToken: data.nextPageToken ?? null };
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw driveFailure();
    }
  }

  async inspect(id: string) {
    try {
      const { data } = await this.drive.files.get({
        fileId: id,
        fields: "id,name,mimeType,size,webViewLink,trashed",
        supportsAllDrives: true,
      });
      if (!data.id || !data.name || data.trashed) {
        throw new DomainError("That Drive file is missing or in the trash.");
      }
      return {
        id: data.id,
        name: data.name,
        mimeType: data.mimeType || "application/octet-stream",
        size: Number(data.size ?? 0),
        url: safeDriveUrl(data.webViewLink),
        folder: data.mimeType === "application/vnd.google-apps.folder",
      };
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw driveFailure();
    }
  }

  async list(courseId: string) {
    try {
      const docs: DriveDoc[] = [];
      let pageToken: string | undefined;
      do {
        const { data } = await this.drive.files.list({
          q: `appProperties has { key='classroomCourseId' and value='${courseId.replaceAll("'", "\\'")}' } and trashed=false`,
          fields:
            "nextPageToken, files(id,name,description,webViewLink,appProperties)",
          pageSize: 50,
          pageToken,
          spaces: "drive",
        });
        for (const file of data.files ?? []) {
          docs.push(asDoc(file, courseId));
        }
        pageToken = data.nextPageToken ?? undefined;
      } while (pageToken && docs.length < 200);
      return docs;
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw driveFailure();
    }
  }

  async get(id: string) {
    try {
      const { data } = await this.drive.files.get({
        fileId: id,
        fields: "id,name,description,webViewLink,appProperties",
      });
      const record = asDoc(data);
      if (record.id !== id) {
        throw new DomainError("Drive returned a different file ID than requested.");
      }
      return record;
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw driveFailure();
    }
  }

  async create(
    input: {
      title: string;
      description: string;
      details: string;
      courseId: string;
      courseWorkId?: string | null;
    },
    beforeWrite: () => Promise<void>,
  ) {
    await beforeWrite();
    try {
      const { data } = await this.drive.files.create({
        requestBody: {
          name: input.title,
          mimeType: "application/vnd.google-apps.document",
          description: input.description,
          appProperties: {
            classroomCourseId: input.courseId,
            classroomCourseWorkId: input.courseWorkId ?? "",
            agentsEverywhere: "1",
          },
        },
        media: {
          mimeType: "text/plain",
          body: input.details,
        },
        fields: "id,name,description,webViewLink,appProperties",
      });
      return asDoc(data, input.courseId);
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw driveFailure();
    }
  }
}

export function googleApiClients(session: GoogleSession): {
  classroom: ClassroomReader;
  drive: DriveDocs;
} {
  const auth = createOAuthClient();
  auth.setCredentials({
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
    expiry_date: session.expiryDate,
  });
  return {
    classroom: new GoogleClassroomReader(
      google.classroom({ version: "v1", auth }),
    ),
    drive: new GoogleDriveDocs(google.drive({ version: "v3", auth }), {
      email: session.email,
      name: session.name,
    }),
  };
}
