// ---------------------------------------------------------------------------
// HiBob API client — Service Account auth (Basic auth)
// ---------------------------------------------------------------------------

const HIBOB_API_BASE = "https://api.hibob.com/v1";

export type HiBobPerson = {
  id: string;
  displayName: string;
  work?: {
    department?: string;
    division?: string;
    team?: string;
  };
};

export type HiBobCompanyStructure = {
  divisions?: Array<{ id: string; name: string }>;
  departments?: Array<{ id: string; name: string; divisionId?: string }>;
  teams?: Array<{ id: string; name: string; departmentId?: string }>;
};

function authHeader(serviceId: string, token: string): HeadersInit {
  const encoded = Buffer.from(`${serviceId}:${token}`).toString("base64");
  return {
    Authorization: `Basic ${encoded}`,
    Accept: "application/json",
  };
}

/**
 * Validate HiBob credentials by fetching a single person.
 */
export async function validateCredentials(
  serviceId: string,
  token: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `${HIBOB_API_BASE}/people?showInactive=false&limit=1`,
      { headers: authHeader(serviceId, token) }
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch company structure from HiBob named lists.
 * HiBob stores divisions, departments, teams as named lists.
 */
export async function fetchCompanyStructure(
  serviceId: string,
  token: string
): Promise<HiBobCompanyStructure> {
  const headers = authHeader(serviceId, token);
  const structure: HiBobCompanyStructure = {};

  // Fetch named lists that represent org structure
  const listNames = [
    "work.department",
    "work.division",
    "work.team",
  ];

  for (const listName of listNames) {
    try {
      const res = await fetch(
        `${HIBOB_API_BASE}/company/named-lists/${listName}`,
        { headers }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const items = (data.values ?? []) as Array<{
        id: string;
        name: string;
        parentId?: string;
      }>;

      if (listName === "work.division") {
        structure.divisions = items.map((i) => ({ id: i.id, name: i.name }));
      } else if (listName === "work.department") {
        structure.departments = items.map((i) => ({
          id: i.id,
          name: i.name,
          divisionId: i.parentId,
        }));
      } else if (listName === "work.team") {
        structure.teams = items.map((i) => ({
          id: i.id,
          name: i.name,
          departmentId: i.parentId,
        }));
      }
    } catch {
      // Non-fatal — continue with other lists
    }
  }

  return structure;
}
