import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import type { AppUser } from "@prosbymax/types";
import { loadStore, updateStore, createStoredUser, toPublicUser, verifyPassword, findSessionUser, createPlanFromTemplate, findActivePlanTemplateById, createPlanEvent } from "@/lib/persistent-store";

const authCookieName = "prosbymax-session";
const sessionTtlMs = 1000 * 60 * 60 * 24 * 30;

type StoredUser = AppUser & {
  passwordSalt: string;
  passwordHash: string;
  passwordUpdatedAt: string;
  activePlanId: string | null;
};

function createStoredSession(userId: string, token: string) {
  const now = new Date().toISOString();
  return {
    token,
    userId,
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(Date.now() + sessionTtlMs).toISOString()
  };
}

async function resolveCurrentSessionToken(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(authCookieName)?.value ?? null;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const store = await loadStore();
  const token = await resolveCurrentSessionToken();
  return findSessionUser(store, token);
}

export async function updateCurrentUser(
  patch: Partial<Pick<AppUser, "displayName" | "email">>
): Promise<AppUser | null> {
  const token = await resolveCurrentSessionToken();
  if (!token) return null;

  const now = new Date().toISOString();
  const updatedStore = await updateStore((store) => {
    const session = store.sessions.find((entry) => entry.token === token);
    if (!session) return store;

    return {
      ...store,
      users: store.users.map((user) =>
        user.id === session.userId
          ? {
              ...user,
              ...patch,
              updatedAt: now
            }
          : user
      )
    };
  });

  return findSessionUser(updatedStore, token);
}

export async function createUserAccount(input: {
  displayName: string;
  email: string;
  password: string;
  role?: AppUser["role"];
  templateId?: string;
}): Promise<AppUser | null> {
  const email = input.email.trim().toLowerCase();
  const now = new Date().toISOString();
  let created: StoredUser | null = null;

  await updateStore((store) => {
    if (store.users.some((user) => user.email?.toLowerCase() === email)) {
      return store;
    }

    const requestedTemplate = findActivePlanTemplateById(store, input.templateId);
    const template =
      requestedTemplate ??
      store.planCatalog.find((entry) => entry.status === "active") ??
      null;
    if (!template) {
      return store;
    }

    const plan = createPlanFromTemplate(store, `user-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`, template.id);
    created = createStoredUser({
      id: plan.userId,
      role: input.role ?? "user",
      displayName: input.displayName.trim(),
      email,
      password: input.password,
      createdAt: now,
      updatedAt: now,
      activePlanId: plan.id
    }) as StoredUser;

    const createdUser = created;
    if (!createdUser) return store;

    return {
      ...store,
      users: [...store.users, createdUser],
      userPlans: [
        ...store.userPlans.map((entry) =>
          entry.userId === createdUser.id && entry.status === "active"
            ? { ...entry, status: "cancelled" as const }
            : entry
        ),
        plan
      ],
      planInstanceEvents: [
        createPlanEvent({
          userId: createdUser.id,
          planId: plan.id,
          templateId: template.id,
          templateName: template.name,
          type: "joined",
          notes: "Registered account selected plan"
        }),
        ...store.planInstanceEvents
      ]
    };
  });

  return created ? toPublicUser(created) : null;
}

export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  const store = await loadStore();
  const normalized = email.trim().toLowerCase();
  return (store.users.find((user) => user.email?.toLowerCase() === normalized) as StoredUser | undefined) ?? null;
}

export async function authenticateUser(email: string, password: string): Promise<AppUser | null> {
  const user = await findUserByEmail(email);
  if (!user) return null;
  return verifyPassword(user, password) ? toPublicUser(user) : null;
}

export async function createSessionForUser(userId: string): Promise<string> {
  const token = randomBytes(24).toString("hex");
  await updateStore((store) => ({
    ...store,
    sessions: [...store.sessions.filter((session) => session.token !== token), createStoredSession(userId, token)]
  }));
  return token;
}

export async function deleteSession(token: string): Promise<void> {
  await updateStore((store) => ({
    ...store,
    sessions: store.sessions.filter((session) => session.token !== token)
  }));
}

export async function listUsers(): Promise<AppUser[]> {
  const store = await loadStore();
  return store.users.map(toPublicUser);
}
