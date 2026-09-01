"use client";

import { useRef, useState, useTransition } from "react";
import { Trash2, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/alert";
import { LogoMark } from "@/components/brand/logo-mark";
import { setOrganizationLogoUrl } from "@/lib/organizations/actions";
import { createClient } from "@/lib/supabase/client";

const LOGO_BUCKET = "org-logos";
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export function OrgLogoForm({
  organizationId,
  currentLogoUrl,
}: {
  organizationId: string;
  currentLogoUrl: string | null;
}) {
  const [preview, setPreview] = useState(currentLogoUrl);
  const [linkInput, setLinkInput] = useState(currentLogoUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Formato não suportado. Use PNG, JPG, WEBP ou SVG.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError("Arquivo muito grande (máximo de 2MB)");
      return;
    }

    setError(null);
    setIsUploading(true);

    const supabase = createClient();
    const path = `${organizationId}/logo`;
    const { error: uploadError } = await supabase.storage
      .from(LOGO_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      setIsUploading(false);
      setError("Não foi possível enviar a imagem");
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
    // Cache-bust so re-uploading at the same fixed path shows the new image
    // right away instead of a stale browser-cached copy of the old one.
    const bustedUrl = `${publicUrl}?v=${Date.now()}`;

    const result = await setOrganizationLogoUrl(bustedUrl);
    setIsUploading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setPreview(bustedUrl);
    setLinkInput(bustedUrl);
  }

  function handleSaveLink() {
    setError(null);
    startTransition(async () => {
      const result = await setOrganizationLogoUrl(linkInput.trim());
      if (result.error) {
        setError(result.error);
        return;
      }
      setPreview(linkInput.trim());
    });
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const result = await setOrganizationLogoUrl(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      setPreview(null);
      setLinkInput("");
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {preview ? (
          <img
            src={preview}
            alt="Logo atual"
            className="h-16 w-16 rounded-xl border border-slate-200 object-cover dark:border-slate-800"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
            <LogoMark className="h-10 w-10" />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_TYPES.join(",")}
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="secondary"
              isLoading={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" aria-hidden />
              Enviar imagem
            </Button>
            {preview && (
              <Button
                type="button"
                variant="secondary"
                isLoading={isPending}
                onClick={handleRemove}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Remover
              </Button>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            PNG, JPG, WEBP ou SVG — até 2MB.
          </p>
        </div>
      </div>

      {error && <ErrorAlert>{error}</ErrorAlert>}

      <div className="border-t border-slate-200 pt-6 dark:border-slate-800">
        <p className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
          Ou use um link de imagem
        </p>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Label htmlFor="logoUrl">URL da imagem</Label>
            <Input
              id="logoUrl"
              type="url"
              placeholder="https://exemplo.com/logo.png"
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
            />
          </div>
          <Button type="button" isLoading={isPending} onClick={handleSaveLink}>
            Salvar link
          </Button>
        </div>
      </div>
    </div>
  );
}
