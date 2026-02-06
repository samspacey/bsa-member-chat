import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

interface Lead {
  email: string;
  societyId: string;
  societyName: string;
  timestamp: string;
}

const LEADS_FILE = path.join(process.cwd(), "data", "leads.json");

function ensureLeadsFile() {
  const dir = path.dirname(LEADS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(LEADS_FILE)) {
    fs.writeFileSync(LEADS_FILE, "[]", "utf8");
  }
}

function readLeads(): Lead[] {
  ensureLeadsFile();
  try {
    const data = fs.readFileSync(LEADS_FILE, "utf8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function writeLeads(leads: Lead[]) {
  ensureLeadsFile();
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), "utf8");
}

export async function GET() {
  const leads = readLeads();
  return NextResponse.json({ leads, count: leads.length });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, societyId, societyName } = body;

    if (!email || !societyId || !societyName) {
      return NextResponse.json(
        { error: "email, societyId, and societyName are required" },
        { status: 400 }
      );
    }

    const lead: Lead = {
      email,
      societyId,
      societyName,
      timestamp: new Date().toISOString(),
    };

    const leads = readLeads();
    leads.push(lead);
    writeLeads(leads);

    console.log(`[LEAD] New lead captured: ${email} for ${societyName}`);

    return NextResponse.json({ success: true, lead });
  } catch (error) {
    console.error("[LEAD] Error saving lead:", error);
    return NextResponse.json(
      { error: "Failed to save lead" },
      { status: 500 }
    );
  }
}
