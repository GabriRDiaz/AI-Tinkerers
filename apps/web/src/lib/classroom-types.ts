export type ClassroomCourse = {
  id: string;
  name: string;
  section: string | null;
  descriptionHeading: string | null;
  room: string | null;
  courseState: string | null;
  alternateLink: string | null;
};

export type ClassroomAssignment = {
  id: string;
  title: string;
  description: string | null;
  state: string | null;
  dueDate: string | null;
  workType: string | null;
  alternateLink: string | null;
};

export type DriveDoc = {
  id: string;
  title: string;
  description: string;
  url: string | null;
  courseId: string;
};

export type GoogleUser = {
  email: string;
  name: string;
};

export type DocProposal = {
  id: string;
  courseId: string;
  courseWorkId: string | null;
  title: string;
  description: string;
  identityEmail: string;
  identityName: string;
  expiresAt: number;
};

export type GoogleAuthStatus =
  | { status: "unconfigured"; message: string }
  | { status: "signed_out"; message: string }
  | { status: "signed_in"; user: GoogleUser };
