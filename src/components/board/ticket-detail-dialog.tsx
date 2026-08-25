"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { clsx } from "clsx";
import { CheckCircle2, Paperclip, Trash2, XCircle, BellRing } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/alert";
import {
  ClientSelect,
  TypeSelect,
  SprintSelect,
  DeveloperSelect,
  RequesterSelect,
} from "@/components/board/ticket-select-fields";
import { createClient } from "@/lib/supabase/client";
import { parseTicketFormFields } from "@/lib/tickets/parse-ticket-form";
import type { Tables } from "@/types/database.types";

type HistoryRow = Tables<"ticket_history">;
type CommentRow = Tables<"ticket_comments">;
type AttachmentRow = Tables<"ticket_attachments">;

const ATTACHMENTS_BUCKET = "ticket-attachments";
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TicketDetailDialog({
  ticket,
  onClose,
  statuses,
  sprints,
  clients,
  ticketTypes,
  membersById,
  members,
  developers,
  canApprove,
  isAdmin,
  currentUserId,
  scrollToCommentId,
  onUpdated,
  onDeleted,
}: {
  ticket: Tables<"tickets">;
  onClose: () => void;
  statuses: Tables<"statuses">[];
  sprints: Tables<"sprints">[];
  clients: Tables<"clients">[];
  ticketTypes: Tables<"ticket_types">[];
  membersById: Map<string, string>;
  members: { id: string; name: string }[];
  developers: { id: string; name: string }[];
  canApprove: boolean;
  isAdmin: boolean;
  currentUserId: string;
  scrollToCommentId?: string;
  onUpdated: (ticket: Tables<"tickets">) => void;
  onDeleted: (ticketId: string) => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [showApproveForm, setShowApproveForm] = useState(false);
  const [executionDateInput, setExecutionDateInput] = useState("");
  const [isDenying, setIsDenying] = useState(false);
  const [isMarkingFollowup, setIsMarkingFollowup] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const [comments, setComments] = useState<CommentRow[] | null>(null);
  const [commentsError, setCommentsError] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [postCommentError, setPostCommentError] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionedMembers, setMentionedMembers] = useState<
    { id: string; name: string }[]
  >([]);
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(
    null
  );
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [attachments, setAttachments] = useState<AttachmentRow[] | null>(null);
  const [attachmentsError, setAttachmentsError] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Map<string, string>>(new Map());
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const statusesById = useMemo(
    () => new Map(statuses.map((s) => [s.id, s.name])),
    [statuses]
  );
  // Set by an admin in /settings/statuses ("coluna de negados") — no status
  // is force-created for any org, so this can legitimately be undefined
  // until one is configured, in which case the Negar button just doesn't
  // render (nothing sensible to route the ticket to yet).
  const deniedStatus = useMemo(
    () => statuses.find((s) => s.is_denied),
    [statuses]
  );
  const currentStatus = useMemo(
    () => statuses.find((s) => s.id === ticket.status_id),
    [statuses, ticket.status_id]
  );
  const sprintsById = useMemo(
    () => new Map(sprints.map((s) => [s.id, s.name])),
    [sprints]
  );

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    supabase
      .from("ticket_history")
      .select("*")
      .eq("ticket_id", ticket.id)
      .order("moved_at", { ascending: false })
      .limit(50)
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) {
          setHistoryError(true);
          return;
        }
        setHistory(data ?? []);
      });

    return () => {
      cancelled = true;
    };
  }, [ticket.id]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    supabase
      .from("ticket_comments")
      .select("*")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) {
          setCommentsError(true);
          return;
        }
        setComments(data ?? []);
      });

    return () => {
      cancelled = true;
    };
  }, [ticket.id]);

  // Deep link from a notification click — once the mentioned comment is in
  // the loaded list, scroll it into view and flash a highlight so it's easy
  // to spot in a long thread.
  useEffect(() => {
    if (!scrollToCommentId || !comments) return;
    if (!comments.some((c) => c.id === scrollToCommentId)) return;

    const el = document.getElementById(`comment-${scrollToCommentId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedCommentId(scrollToCommentId);
    const timeout = setTimeout(() => setHighlightedCommentId(null), 2000);
    return () => clearTimeout(timeout);
  }, [scrollToCommentId, comments]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    supabase
      .from("ticket_attachments")
      .select("*")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true })
      .then(async ({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) {
          setAttachmentsError(true);
          return;
        }
        setAttachments(data ?? []);

        if (data && data.length > 0) {
          const { data: signedData } = await supabase.storage
            .from(ATTACHMENTS_BUCKET)
            .createSignedUrls(
              data.map((a) => a.file_path),
              3600
            );
          if (!cancelled && signedData) {
            setSignedUrls(
              new Map(
                signedData
                  .filter((s) => s.signedUrl && s.path)
                  .map((s) => [s.path as string, s.signedUrl as string])
              )
            );
          }
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ticket.id]);

  async function uploadFile(file: File) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setUploadError("Arquivo muito grande (máximo de 10MB)");
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    const supabase = createClient();

    const path = `${ticket.organization_id}/${ticket.id}/${crypto.randomUUID()}-${file.name}`;
    const { error: uploadStorageError } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .upload(path, file);

    if (uploadStorageError) {
      setIsUploading(false);
      setUploadError("Não foi possível enviar o arquivo");
      return;
    }

    const { data, error: insertError } = await supabase
      .from("ticket_attachments")
      .insert({
        ticket_id: ticket.id,
        uploaded_by: currentUserId,
        file_path: path,
        file_name: file.name,
        file_size: file.size,
        content_type: file.type || "application/octet-stream",
      })
      .select()
      .single();

    if (insertError || !data) {
      setIsUploading(false);
      setUploadError("Não foi possível salvar o anexo");
      return;
    }

    setAttachments((prev) => [...(prev ?? []), data]);

    const { data: signedData } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .createSignedUrl(path, 3600);

    setIsUploading(false);

    if (signedData?.signedUrl) {
      setSignedUrls((prev) => new Map(prev).set(path, signedData.signedUrl));
    }
  }

  async function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await uploadFile(file);
  }

  // Lets a screenshot go straight from the clipboard onto the ticket
  // without a save-to-disk detour. Only acts when the clipboard actually
  // has image data — pasting text anywhere else in the dialog (e.g. the
  // comment box) is untouched since there's nothing to intercept there.
  function handlePaste(e: React.ClipboardEvent<HTMLFormElement>) {
    const items = Array.from(e.clipboardData?.items ?? []);
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;

    const file = imageItem.getAsFile();
    if (!file) return;

    e.preventDefault();
    const extension = imageItem.type.split("/")[1] || "png";
    uploadFile(
      new File([file], `colado-${Date.now()}.${extension}`, { type: imageItem.type })
    );
  }

  async function handlePostComment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = commentBody.trim();
    if (!body) return;

    setIsPostingComment(true);
    setPostCommentError(null);
    const supabase = createClient();

    const { data, error: insertError } = await supabase
      .from("ticket_comments")
      .insert({ ticket_id: ticket.id, author_id: currentUserId, body })
      .select()
      .single();

    setIsPostingComment(false);

    if (insertError || !data) {
      setPostCommentError("Não foi possível enviar o comentário");
      return;
    }

    setComments((prev) => [...(prev ?? []), data]);
    setCommentBody("");

    // Only notify names still actually present in the final text — guards
    // against picking someone from the autocomplete and then deleting the
    // @mention before sending — and never notify yourself.
    const recipients = mentionedMembers.filter(
      (m) => m.id !== currentUserId && body.includes(`@${m.name}`)
    );
    setMentionedMembers([]);

    if (recipients.length > 0) {
      await supabase.from("notifications").insert(
        recipients.map((m) => ({
          recipient_id: m.id,
          actor_id: currentUserId,
          ticket_id: ticket.id,
          comment_id: data.id,
          body_preview: body.slice(0, 140),
        }))
      );
    }
  }

  function handleCommentBodyChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setCommentBody(value);

    const beforeCursor = value.slice(0, e.target.selectionStart ?? value.length);
    const match = beforeCursor.match(/@(\w*)$/);
    setMentionQuery(match ? match[1] : null);
  }

  function handleSelectMention(member: { id: string; name: string }) {
    const textarea = commentTextareaRef.current;
    const cursor = textarea?.selectionStart ?? commentBody.length;
    const before = commentBody.slice(0, cursor).replace(/@(\w*)$/, `@${member.name} `);
    const after = commentBody.slice(cursor);
    const nextValue = before + after;

    setCommentBody(nextValue);
    setMentionedMembers((prev) =>
      prev.some((m) => m.id === member.id) ? prev : [...prev, member]
    );
    setMentionQuery(null);

    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(before.length, before.length);
    });
  }

  const mentionOptions =
    mentionQuery === null
      ? []
      : members
          .filter((m) => m.name.toLowerCase().includes(mentionQuery.toLowerCase()))
          .slice(0, 6);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const { title, ticketNumber, error: validationError } =
      parseTicketFormFields(formData);

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    const supabase = createClient();

    const newStatusId = String(formData.get("statusId") ?? ticket.status_id);
    const sprintValue = String(formData.get("sprintId") ?? "");
    const newSprintId = sprintValue || null;
    const statusChanged = newStatusId !== ticket.status_id;
    const sprintChanged = newSprintId !== ticket.sprint_id;

    if (statusChanged || sprintChanged) {
      const { error: moveError } = await supabase.rpc("move_ticket", {
        p_ticket_id: ticket.id,
        p_new_status_id: statusChanged ? newStatusId : undefined,
        p_new_sprint_id: sprintChanged ? newSprintId ?? undefined : undefined,
        p_sprint_explicitly_set: sprintChanged,
      });

      if (moveError) {
        setError("Não foi possível mover o chamado");
        setIsSaving(false);
        return;
      }
    }

    const clientValue = String(formData.get("clientId") ?? "");
    const typeValue = String(formData.get("typeId") ?? "");
    const developerValue = String(formData.get("developerId") ?? "");
    const deadlineValue = String(formData.get("deadline") ?? "");
    const executionDeadlineValue = String(formData.get("executionDeadline") ?? "");
    const description = String(formData.get("description") ?? "").trim();
    const requesterValue = String(formData.get("requesterId") ?? "") || ticket.created_by;

    const { data, error: updateError } = await supabase
      .from("tickets")
      .update({
        title,
        ticket_number: ticketNumber,
        description: description || null,
        urgency: formData.get("urgency") as Tables<"tickets">["urgency"],
        client_id: clientValue || null,
        type_id: typeValue || null,
        developer_id: developerValue || null,
        deadline: deadlineValue || null,
        execution_deadline: executionDeadlineValue || null,
        status_id: newStatusId,
        sprint_id: newSprintId,
        created_by: requesterValue,
      })
      .eq("id", ticket.id)
      .select()
      .single();

    setIsSaving(false);

    if (updateError || !data) {
      setError(
        updateError?.code === "23505"
          ? "Já existe um chamado com esse número"
          : "Não foi possível salvar as alterações"
      );
      return;
    }

    onUpdated(data);
    onClose();
  }

  // Execution deadline is captured right here instead of left as a normal
  // form field — while it's known, it's more likely to get filled in this
  // way than left for someone to remember separately afterward. It's
  // optional though: some tickets get approved before a start date is
  // known, and that shouldn't block approval — it can be set later from
  // the Execução prevista field below.
  async function handleApprove() {
    setIsApproving(true);
    const supabase = createClient();
    const { data, error: approveError } = await supabase
      .from("tickets")
      .update({ approved: true, execution_deadline: executionDateInput || null })
      .eq("id", ticket.id)
      .select()
      .single();

    setIsApproving(false);

    if (approveError || !data) {
      setError("Não foi possível aprovar o chamado");
      return;
    }

    setShowApproveForm(false);
    onUpdated(data);
  }

  async function handleMarkFollowedUp() {
    setIsMarkingFollowup(true);
    const supabase = createClient();
    const { data, error: followupError } = await supabase
      .from("tickets")
      .update({ last_followup_at: new Date().toISOString() })
      .eq("id", ticket.id)
      .select()
      .single();

    setIsMarkingFollowup(false);

    if (followupError || !data) {
      setError("Não foi possível marcar a cobrança");
      return;
    }

    onUpdated(data);
  }

  // Routed through move_ticket (not a plain .update()) so ticket_history
  // logs the move like any other status change — same reason drag-and-drop
  // and the bulk-actions bar use it instead of updating status_id directly.
  // Deliberately doesn't touch `approved`: denying is a distinct outcome
  // from approval, not the same field's negative case.
  async function handleDeny() {
    if (!deniedStatus) return;

    setIsDenying(true);
    const supabase = createClient();
    const { error: denyError } = await supabase.rpc("move_ticket", {
      p_ticket_id: ticket.id,
      p_new_status_id: deniedStatus.id,
    });
    setIsDenying(false);

    if (denyError) {
      setError("Não foi possível negar o chamado");
      return;
    }

    onUpdated({ ...ticket, status_id: deniedStatus.id });
  }

  async function handleDelete() {
    if (!window.confirm("Excluir este chamado? Essa ação não pode ser desfeita.")) {
      return;
    }

    setIsDeleting(true);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("tickets")
      .delete()
      .eq("id", ticket.id);

    setIsDeleting(false);

    if (deleteError) {
      setError("Não foi possível excluir o chamado");
      return;
    }

    onDeleted(ticket.id);
    onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Chamado #${ticket.ticket_number}`}
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} onPaste={handlePaste} className="space-y-4">
        {error && <ErrorAlert>{error}</ErrorAlert>}

        <div className="flex items-center justify-between gap-3">
          {ticket.approved ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              Aprovado
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              Pendente de aprovação
            </span>
          )}

          {showApproveForm ? (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                autoFocus
                value={executionDateInput}
                onChange={(e) => setExecutionDateInput(e.target.value)}
                aria-label="Execução prevista (opcional)"
                placeholder="Opcional"
                className="w-40"
              />
              <Button type="button" isLoading={isApproving} onClick={handleApprove}>
                Confirmar aprovação
              </Button>
              <button
                type="button"
                onClick={() => {
                  setShowApproveForm(false);
                  setExecutionDateInput("");
                }}
                className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Cancelar
              </button>
            </div>
          ) : (
          <div className="flex items-center gap-2">
            {!ticket.approved && canApprove && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowApproveForm(true)}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Aprovar
              </Button>
            )}
            {canApprove && deniedStatus && ticket.status_id !== deniedStatus.id && (
              <Button
                type="button"
                variant="secondary"
                isLoading={isDenying}
                onClick={handleDeny}
                className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                <XCircle className="h-4 w-4" aria-hidden />
                Negar
              </Button>
            )}
            {ticket.next_followup_due &&
              !currentStatus?.is_terminal &&
              !currentStatus?.is_denied && (
                <Button
                  type="button"
                  variant="secondary"
                  isLoading={isMarkingFollowup}
                  onClick={handleMarkFollowedUp}
                >
                  <BellRing className="h-4 w-4" aria-hidden />
                  Marquei a cobrança
                </Button>
              )}
            {isAdmin && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                aria-label="Excluir chamado"
                className="rounded-md p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="ticketNumber">Número do chamado</Label>
            <Input
              id="ticketNumber"
              name="ticketNumber"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              required
              defaultValue={ticket.ticket_number}
            />
          </div>
          <div>
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              name="title"
              defaultValue={ticket.title}
              required
              maxLength={200}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="description">Descrição</Label>
          <Textarea
            id="description"
            name="description"
            rows={3}
            maxLength={4000}
            defaultValue={ticket.description ?? ""}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="statusId">Status</Label>
            {/* Uncontrolled field (defaultValue) — key resets it when
                status_id changes without the dialog closing, which
                otherwise only happens via handleSubmit (closes right
                after) or handleApprove (never changes status_id). Negar
                is the first action that changes status_id and keeps the
                dialog open, so without this the select would keep
                showing the pre-Negar status. */}
            <Select
              key={ticket.status_id}
              id="statusId"
              name="statusId"
              defaultValue={ticket.status_id}
            >
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="urgency">Urgência</Label>
            <Select id="urgency" name="urgency" defaultValue={ticket.urgency}>
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
              <option value="critical">Crítica</option>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <ClientSelect clients={clients} defaultValue={ticket.client_id} />
          <TypeSelect ticketTypes={ticketTypes} defaultValue={ticket.type_id} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <SprintSelect sprints={sprints} defaultValue={ticket.sprint_id} />
          <div>
            <Label htmlFor="deadline">Prazo (previsão de aprovação)</Label>
            <Input
              id="deadline"
              name="deadline"
              type="date"
              defaultValue={ticket.deadline ?? ""}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <RequesterSelect members={members} defaultValue={ticket.created_by} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <DeveloperSelect developers={developers} defaultValue={ticket.developer_id} />
          <div>
            <Label htmlFor="executionDeadline">Execução prevista</Label>
            {/* Same uncontrolled-field staleness issue as the Status select
                above — handleApprove sets execution_deadline while the
                dialog stays open, so this needs the same key reset. */}
            <Input
              key={ticket.execution_deadline ?? "none"}
              id="executionDeadline"
              name="executionDeadline"
              type="date"
              defaultValue={ticket.execution_deadline ?? ""}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isSaving}>
            Salvar alterações
          </Button>
        </div>
      </form>

      <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
        <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
          Anexos
        </h3>

        {uploadError && <ErrorAlert>{uploadError}</ErrorAlert>}

        {attachmentsError ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            Não foi possível carregar os anexos. Tente novamente.
          </p>
        ) : attachments === null ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Carregando...</p>
        ) : attachments.length === 0 ? (
          <p className="mb-3 text-sm text-slate-400 dark:text-slate-500">
            Nenhum anexo ainda.
          </p>
        ) : (
          <ul className="mb-3 space-y-2">
            {attachments.map((attachment) => {
              const url = signedUrls.get(attachment.file_path);
              return (
                <li key={attachment.id} className="flex items-center gap-2 text-sm">
                  <Paperclip
                    className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500"
                    aria-hidden
                  />
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {attachment.file_name}
                    </a>
                  ) : (
                    <span className="truncate text-slate-600 dark:text-slate-300">
                      {attachment.file_name}
                    </span>
                  )}
                  <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
                    {formatFileSize(attachment.file_size)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <label className="inline-block">
          <span
            className={
              "inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800" +
              (isUploading ? " pointer-events-none opacity-50" : "")
            }
          >
            <Paperclip className="h-4 w-4" aria-hidden />
            {isUploading ? "Enviando..." : "Anexar arquivo"}
          </span>
          <input
            type="file"
            className="hidden"
            disabled={isUploading}
            onChange={handleFileUpload}
            accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain,text/csv,application/json,application/zip"
          />
        </label>
        <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
          ou cole uma imagem (Ctrl+V)
        </p>
      </div>

      <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
        <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
          Comentários
        </h3>

        {commentsError ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            Não foi possível carregar os comentários. Tente novamente.
          </p>
        ) : comments === null ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Carregando...</p>
        ) : (
          <ul className="mb-4 space-y-3">
            {comments.length === 0 && (
              <li className="text-sm text-slate-400 dark:text-slate-500">
                Nenhum comentário ainda.
              </li>
            )}
            {comments.map((comment) => (
              <li
                key={comment.id}
                id={`comment-${comment.id}`}
                className={clsx(
                  "rounded-md px-3 py-2 transition-colors duration-500",
                  highlightedCommentId === comment.id
                    ? "bg-indigo-100 dark:bg-indigo-950/60"
                    : "bg-slate-50 dark:bg-slate-900"
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {membersById.get(comment.author_id) ?? "Alguém"}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {new Date(comment.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                  {comment.body}
                </p>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handlePostComment} className="space-y-2">
          {postCommentError && <ErrorAlert>{postCommentError}</ErrorAlert>}
          <div className="relative">
            <Textarea
              ref={commentTextareaRef}
              aria-label="Novo comentário"
              rows={2}
              maxLength={2000}
              placeholder="Escreva um comentário... use @ pra mencionar alguém"
              value={commentBody}
              onChange={handleCommentBodyChange}
            />
            {mentionOptions.length > 0 && (
              <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                {mentionOptions.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelectMention(m)}
                    className="block w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="secondary"
              isLoading={isPostingComment}
              disabled={!commentBody.trim()}
            >
              Comentar
            </Button>
          </div>
        </form>
      </div>

      <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
        <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
          Histórico
        </h3>

        {historyError ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            Não foi possível carregar o histórico. Tente novamente.
          </p>
        ) : history === null ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Carregando...</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Nenhuma movimentação registrada ainda.
          </p>
        ) : (
          <ul className="space-y-3">
            {history.map((entry) => (
              <li key={entry.id} className="text-sm text-slate-600 dark:text-slate-300">
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {membersById.get(entry.moved_by) ?? "Alguém"}
                </span>{" "}
                {entry.from_status_id !== entry.to_status_id && (
                  <>
                    moveu de{" "}
                    <span className="font-medium">
                      {entry.from_status_id
                        ? statusesById.get(entry.from_status_id) ?? "—"
                        : "—"}
                    </span>{" "}
                    para{" "}
                    <span className="font-medium">
                      {entry.to_status_id
                        ? statusesById.get(entry.to_status_id) ?? "—"
                        : "—"}
                    </span>
                  </>
                )}
                {entry.from_sprint_id !== entry.to_sprint_id && (
                  <>
                    {entry.from_status_id !== entry.to_status_id ? " e " : "alterou a sprint "}
                    de{" "}
                    <span className="font-medium">
                      {entry.from_sprint_id
                        ? sprintsById.get(entry.from_sprint_id) ?? "—"
                        : "nenhuma"}
                    </span>{" "}
                    para{" "}
                    <span className="font-medium">
                      {entry.to_sprint_id
                        ? sprintsById.get(entry.to_sprint_id) ?? "—"
                        : "nenhuma"}
                    </span>
                  </>
                )}
                <span className="ml-1 text-xs text-slate-400 dark:text-slate-500">
                  {new Date(entry.moved_at).toLocaleString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
