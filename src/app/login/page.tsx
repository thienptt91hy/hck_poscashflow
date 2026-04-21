import { LoginForm } from "./login-form";
import { getLocale } from "@/lib/locale-server";
import { getDictionary } from "@/i18n/dictionaries";
import { LocaleSwitcher } from "@/components/locale-switcher";

export default async function LoginPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-zinc-900">{dict.app.name}</h1>
          <p className="mt-1 text-sm text-zinc-500">{dict.app.tagline}</p>
        </div>
        <LoginForm dict={dict} />
        <div className="mt-6 flex justify-center">
          <LocaleSwitcher currentLocale={locale} />
        </div>
      </div>
    </div>
  );
}
