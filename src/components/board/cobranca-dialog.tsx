"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { getCobrancaOptions, sendCobrancaToDiscord } from "@/lib/discord/actions";
import type { Tables } from "@/types/database.types";

const MAX_MESSAGE = 1000;

export function CobrancaDialog({
  ticketId,
  ticketNumber,
  onClose,
  onSent,
}: {
  ticketId: string;
  ticketNumber: number;
  onClose: () => void;
  // The chamado after the cobrança was recorded on it.
  onSent: (ticket: Tables<"tickets">) => void;
}) {
  const { showToast } = useToast();
  const [message, setMessage] = useState("");
  const [canMentionSupervisor, setCanMentionSupervisor] = useState(false);
  const [mentionSupervisor, setMentionSupervisor] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Whether a supervisor is configured lives on the server (an env var), so
  // the checkbox only appears when there's actually someone to tag. Checked
  // by default: that's how cobranças are already done by hand.
  useEffect(() => {
    let cancelled = false;
    getCobrancaOptions().then((options) => {
      if (cancelled) return;
      setCanMentionSupervisor(options.supervisorMention);
      setMentionSupervisor(options.supervisorMention);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSending(true);
    const result = await sendCobrancaToDiscord(ticketId, {
      message,
      mentionSupervisor,
    });
    setIsSending(false);

    // Even a partial send counts as a cobrança made, so the chamado is
    // refreshed whenever it was recorded.
    if (result.ticket) onSent(result.ticket);

    if (result.error) {
      setError(result.error);
      return;
    }

    showToast(
      result.notMarked
        ? "Cobrança enviada para o Discord, mas não foi possível registrá-la no chamado"
        : "Cobrança enviada para o Discord e registrada no chamado",
      result.notMarked ? "error" : "success"
    );
    onClose();
  }

  return (
    <Dialog open onClose={onClose} title={`Gerar cobrança — #${ticketNumber}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Os dados do chamado (cliente, descrição, execução prevista, link do PDVNET) vão
          automaticamente. Se quiser, escreva uma mensagem que aparece logo abaixo deles. Ao enviar, a cobrança também fica registrada no chamado.
        </p>

        <div>
          <Label htmlFor="cobrancaMessage">Mensagem (opcional)</Label>
          <Textarea
            id="cobrancaMessage"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={MAX_MESSAGE}
            rows={5}
            placeholder="Ex: Cliente pediu urgência, já é a terceira cobrança desse chamado."
          />
          <p className="mt-1 text-right text-xs text-slate-400 dark:text-slate-500">
            {message.length}/{MAX_MESSAGE}
          </p>
        </div>

        {canMentionSupervisor && (
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={mentionSupervisor}
              onChange={(e) => setMentionSupervisor(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800"
            />
            Marcar o supervisor de desenvolvimento
          </label>
        )}

        {error && <ErrorAlert>{error}</ErrorAlert>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isSending}>
            <Send className="h-4 w-4" aria-hidden />
            Enviar cobrança
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
