"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/;
const STORE_SLUG_REGEX = /^[a-z0-9-]{3,40}$/;

function buildRedirectUrl(path: string, params: Record<string, string>) {
  const search = new URLSearchParams(params);
  return `${path}?${search.toString()}`;
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nextPath = String(formData.get("next") ?? "/dashboard").trim();
  const safeNext = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/dashboard";

  if (!email || !password) {
    redirect(
      buildRedirectUrl("/login", {
        error: "Email dan kata sandi wajib diisi.",
        next: safeNext,
      })
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(
      buildRedirectUrl("/login", {
        error: "Email atau kata sandi tidak sesuai. Silakan periksa kembali.",
        next: safeNext,
      })
    );
  }

  revalidatePath("/", "layout");
  redirect(safeNext);
}

export async function registerAction(formData: FormData) {
  const displayName = String(formData.get("display_name") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const accountMode = String(formData.get("account_mode") ?? "buyer").trim();
  const storeName = String(formData.get("store_name") ?? "").trim();
  const storeSlug = String(formData.get("store_slug") ?? "").trim().toLowerCase();
  const storeBio = String(formData.get("store_bio") ?? "").trim();

  if (!displayName || !username || !email || !password) {
    redirect(
      buildRedirectUrl("/register", {
        error: "Nama tampilan, username, email, dan kata sandi wajib diisi.",
        role: accountMode,
      })
    );
  }

  if (!USERNAME_REGEX.test(username)) {
    redirect(
      buildRedirectUrl("/register", {
        error: "Username harus 3-30 karakter dan hanya boleh berisi huruf kecil, angka, atau garis bawah (_).",
        role: accountMode,
      })
    );
  }

  if (password.length < 8) {
    redirect(
      buildRedirectUrl("/register", {
        error: "Kata sandi minimal harus terdiri dari 8 karakter.",
        role: accountMode,
      })
    );
  }

  if (accountMode === "seller") {
    if (!storeName || !storeSlug) {
      redirect(
        buildRedirectUrl("/register", {
          error: "Nama toko dan slug toko wajib diisi untuk pendaftaran seller.",
          role: "seller",
        })
      );
    }

    if (!STORE_SLUG_REGEX.test(storeSlug)) {
      redirect(
        buildRedirectUrl("/register", {
          error: "Slug toko harus 3-40 karakter dan hanya boleh berisi huruf kecil, angka, atau tanda hubung (-).",
          role: "seller",
        })
      );
    }
  }

  const supabase = await createClient();

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        username,
      },
    },
  });

  if (signUpError) {
    redirect(
      buildRedirectUrl("/register", {
        error: signUpError.message,
        role: accountMode,
      })
    );
  }

  if (!signUpData.session || !signUpData.user) {
    redirect(
      buildRedirectUrl("/login", {
        message: "Pendaftaran berhasil. Silakan cek kotak masuk email kamu untuk verifikasi sebelum masuk.",
      })
    );
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      username,
    })
    .eq("id", signUpData.user.id);

  if (profileError) {
    redirect(
      buildRedirectUrl("/register", {
        error: "Username tersebut sudah digunakan. Silakan pilih username lain.",
        role: accountMode,
      })
    );
  }

  if (accountMode === "seller") {
    const { error: sellerError } = await supabase.rpc("register_as_seller", {
      p_store_name: storeName,
      p_store_slug: storeSlug,
      p_bio: storeBio,
      p_qris_static_payload: null,
    });

    if (sellerError) {
      redirect(
        buildRedirectUrl("/dashboard", {
          error: "Akun berhasil dibuat, tetapi slug toko sudah digunakan. Silakan atur ulang toko di dashboard.",
        })
      );
    }
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}