"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  ExternalLinkIcon,
  MailIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import {
  createContact,
  deleteContact,
  type ContactActionState,
} from "@/app/actions/contacts";
import type { Contact } from "@/lib/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="text-xs text-destructive">{errors[0]}</p>;
}

// Build a Google search URL that filters to LinkedIn profiles at a given
// company. Not real auto-discovery — just a one-click jumpstart so the user
// doesn't have to type the search manually.
function buildLinkedInSearchUrl(company: string): string {
  const q = `site:linkedin.com/in "${company}"`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

export function ContactsSection({
  jobId,
  company,
  contacts,
}: {
  jobId: string;
  company: string;
  contacts: Contact[];
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="grid gap-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Contacts</h4>
        <a
          href={buildLinkedInSearchUrl(company)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <SearchIcon className="size-3" />
          Find people at {company} on LinkedIn
        </a>
      </div>

      {contacts.length === 0 && !adding ? (
        <p className="text-xs text-muted-foreground">
          No contacts yet. Add someone you might reach out to.
        </p>
      ) : null}

      {contacts.length > 0 ? (
        <ul className="grid gap-2">
          {contacts.map((c) => (
            <li key={c.id}>
              <ContactRow contact={c} />
            </li>
          ))}
        </ul>
      ) : null}

      {adding ? (
        <AddContactForm
          jobId={jobId}
          onCancel={() => setAdding(false)}
          onSaved={() => setAdding(false)}
        />
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAdding(true)}
          className="self-start gap-1"
        >
          <PlusIcon className="size-4" />
          Add contact
        </Button>
      )}
    </div>
  );
}

// One contact line: name + role, action links for LinkedIn/email, delete button.
function ContactRow({ contact }: { contact: Contact }) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deleteContact(contact.id);
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-muted/30 px-3 py-2 text-sm">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium">{contact.name}</span>
          {contact.role ? (
            <span className="text-xs text-muted-foreground">
              — {contact.role}
            </span>
          ) : null}
        </div>
        {contact.notes ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {contact.notes}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {contact.linkedinUrl ? (
          <a
            href={contact.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-primary hover:bg-primary/10"
            aria-label={`Open ${contact.name}'s LinkedIn profile`}
          >
            LinkedIn
            <ExternalLinkIcon className="size-3" />
          </a>
        ) : null}
        {contact.email ? (
          <a
            href={`mailto:${contact.email}`}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-primary hover:bg-primary/10"
            aria-label={`Email ${contact.name}`}
          >
            <MailIcon className="size-3" />
            Email
          </a>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-destructive"
          onClick={handleDelete}
          disabled={pending}
          aria-label={`Delete ${contact.name}`}
        >
          <XIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}

// Inline form for adding a contact. Lives inside the More panel so the user
// doesn't context-switch into a separate sheet.
function AddContactForm({
  jobId,
  onCancel,
  onSaved,
}: {
  jobId: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const action = createContact.bind(null, jobId);
  const [state, formAction, pending] = useActionState<
    ContactActionState | undefined,
    FormData
  >(action, undefined);

  // Collapse the form when the action succeeds.
  useEffect(() => {
    if (state?.ok) onSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="grid gap-2 rounded-md border p-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1">
          <Label htmlFor="contact-name" className="text-xs">
            Name
          </Label>
          <Input
            id="contact-name"
            name="name"
            placeholder="Sam Wang"
            required
            maxLength={100}
          />
          <FieldError errors={state?.fieldErrors?.name} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="contact-role" className="text-xs">
            Role
          </Label>
          <Input
            id="contact-role"
            name="role"
            placeholder="Engineer"
            maxLength={100}
          />
          <FieldError errors={state?.fieldErrors?.role} />
        </div>
      </div>

      <div className="grid gap-1">
        <Label htmlFor="contact-linkedin" className="text-xs">
          LinkedIn URL
        </Label>
        <Input
          id="contact-linkedin"
          name="linkedinUrl"
          type="url"
          placeholder="https://linkedin.com/in/samwang"
        />
        <FieldError errors={state?.fieldErrors?.linkedinUrl} />
      </div>

      <div className="grid gap-1">
        <Label htmlFor="contact-email" className="text-xs">
          Email
        </Label>
        <Input
          id="contact-email"
          name="email"
          type="email"
          placeholder="sam@stripe.com"
        />
        <FieldError errors={state?.fieldErrors?.email} />
      </div>

      <div className="grid gap-1">
        <Label htmlFor="contact-notes" className="text-xs">
          Notes
        </Label>
        <Input
          id="contact-notes"
          name="notes"
          placeholder="Heard about the role from her — said the team's hiring."
          maxLength={2000}
        />
        <FieldError errors={state?.fieldErrors?.notes} />
      </div>

      {state?.error ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}

      <div className="flex justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save contact"}
        </Button>
      </div>
    </form>
  );
}
