import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/auth";
import {
  saveGoogleDriveTokens,
  ensureDriveFolderStructure,
  DRIVE_CONFIG,
} from "@/lib/ai-center/google-drive";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const baseDashboardUrl = new URL("/dashboard/ai-center/drive", url.origin);

  // 1. Verifikasi otorisasi Super Admin aktif
  try {
    const context = await requireCapability("ai_center.manage");
    if (context.role !== "super_admin" || context.membership.status !== "active") {
      return NextResponse.redirect(new URL("/dashboard?error=forbidden", url.origin));
    }
  } catch {
    return NextResponse.redirect(new URL("/dashboard?error=forbidden", url.origin));
  }

  // 2. Periksa error dari callback Google OAuth
  if (error) {
    baseDashboardUrl.searchParams.set("error", `oauth_${error}`);
    return NextResponse.redirect(baseDashboardUrl);
  }

  if (!code) {
    baseDashboardUrl.searchParams.set("error", "missing_code");
    return NextResponse.redirect(baseDashboardUrl);
  }

  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    baseDashboardUrl.searchParams.set("error", "missing_server_credentials");
    return NextResponse.redirect(baseDashboardUrl);
  }

  const redirectUri = `${url.origin}/api/auth/google-drive/callback`;

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      baseDashboardUrl.searchParams.set("error", "token_exchange_failed");
      return NextResponse.redirect(baseDashboardUrl);
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      id_token?: string;
    };

    if (!tokenData.access_token) {
      baseDashboardUrl.searchParams.set("error", "no_access_token_returned");
      return NextResponse.redirect(baseDashboardUrl);
    }

    // Mendapatkan email akun target jika tersedia dari userinfo
    let accountEmail = DRIVE_CONFIG.defaultAccountEmail;
    try {
      const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (userinfoRes.ok) {
        const userInfo = (await userinfoRes.json()) as { email?: string };
        if (userInfo.email) {
          accountEmail = userInfo.email;
        }
      }
    } catch {
      // Gunakan default email jika userinfo tidak tersedia
    }

    // Simpan token secara terenkripsi AES-256
    await saveGoogleDriveTokens({
      accountEmail,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
    });

    // Otomatis verifikasi atau siapkan struktur folder di Google Drive
    await ensureDriveFolderStructure();

    baseDashboardUrl.searchParams.set("success", "connected");
    return NextResponse.redirect(baseDashboardUrl);
  } catch {
    baseDashboardUrl.searchParams.set("error", "connection_exception");
    return NextResponse.redirect(baseDashboardUrl);
  }
}
