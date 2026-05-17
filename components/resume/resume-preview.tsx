"use client";

import { ExternalLinkIcon, MailIcon, MapPinIcon, PhoneIcon } from "lucide-react";
import { parsedResumeSchema, type ParsedResume } from "@/lib/zod-schemas";

// Validates the unknown JSON pulled from the DB and renders it. We re-validate
// here (rather than trusting whatever was saved) because the schema can evolve
// and old data might no longer match. On validation failure we render nothing —
// the parent shows a "Re-parse" affordance instead.
export function ResumePreview({ json }: { json: unknown }) {
  const result = parsedResumeSchema.safeParse(json);
  if (!result.success) return null;
  return <ResumePreviewCards parsed={result.data} />;
}

function ResumePreviewCards({ parsed }: { parsed: ParsedResume }) {
  return (
    <div className="grid gap-4">
      <ContactCard parsed={parsed} />
      {parsed.summary ? <SummaryCard summary={parsed.summary} /> : null}
      {parsed.workExperience.length > 0 ? (
        <WorkExperienceCard items={parsed.workExperience} />
      ) : null}
      {parsed.education.length > 0 ? (
        <EducationCard items={parsed.education} />
      ) : null}
      {parsed.skills.length > 0 ? <SkillsCard skills={parsed.skills} /> : null}
      {parsed.projects.length > 0 ? (
        <ProjectsCard items={parsed.projects} />
      ) : null}
    </div>
  );
}

// ============================================================================
// Section cards
// ============================================================================

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

function ContactCard({ parsed }: { parsed: ParsedResume }) {
  return (
    <Card title="Contact">
      <div className="flex flex-col gap-1 text-sm">
        {parsed.name ? (
          <div className="text-lg font-medium leading-tight">{parsed.name}</div>
        ) : null}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
          {parsed.email ? (
            <span className="inline-flex items-center gap-1">
              <MailIcon className="size-3.5" />
              {parsed.email}
            </span>
          ) : null}
          {parsed.phone ? (
            <span className="inline-flex items-center gap-1">
              <PhoneIcon className="size-3.5" />
              {parsed.phone}
            </span>
          ) : null}
          {parsed.location ? (
            <span className="inline-flex items-center gap-1">
              <MapPinIcon className="size-3.5" />
              {parsed.location}
            </span>
          ) : null}
        </div>
        {parsed.linkedinUrl || parsed.websiteUrl ? (
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {parsed.linkedinUrl ? (
              <ExternalLink href={parsed.linkedinUrl} label="LinkedIn" />
            ) : null}
            {parsed.websiteUrl ? (
              <ExternalLink href={parsed.websiteUrl} label="Website" />
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function SummaryCard({ summary }: { summary: string }) {
  return (
    <Card title="Summary">
      <p className="whitespace-pre-wrap text-sm">{summary}</p>
    </Card>
  );
}

function WorkExperienceCard({
  items,
}: {
  items: ParsedResume["workExperience"];
}) {
  return (
    <Card title="Work experience">
      <ul className="grid gap-4">
        {items.map((item, i) => (
          <li key={`${item.company}-${item.role}-${i}`} className="text-sm">
            <div className="font-medium">
              {item.role}
              <span className="font-normal text-muted-foreground">
                {" "}
                @ {item.company}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {formatDateRange(item.startDate, item.endDate, item.isCurrent)}
              {item.location ? ` · ${item.location}` : ""}
            </div>
            {item.bullets.length > 0 ? (
              <ul className="mt-1.5 grid list-disc gap-1 pl-5 text-muted-foreground marker:text-muted-foreground/50">
                {item.bullets.map((bullet, bi) => (
                  <li key={bi}>{bullet}</li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function EducationCard({ items }: { items: ParsedResume["education"] }) {
  return (
    <Card title="Education">
      <ul className="grid gap-3">
        {items.map((item, i) => (
          <li key={`${item.school}-${i}`} className="text-sm">
            <div className="font-medium">
              {formatDegree(item.degree, item.field)}
              <span className="font-normal text-muted-foreground">
                {" "}
                @ {item.school}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {formatDateRange(item.startDate, item.endDate, false)}
              {item.gpa ? ` · GPA ${item.gpa}` : ""}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function SkillsCard({ skills }: { skills: string[] }) {
  return (
    <Card title="Skills">
      <div className="flex flex-wrap gap-1.5">
        {skills.map((skill, i) => (
          <span
            key={`${skill}-${i}`}
            className="rounded-md bg-muted px-2 py-0.5 text-xs"
          >
            {skill}
          </span>
        ))}
      </div>
    </Card>
  );
}

function ProjectsCard({ items }: { items: ParsedResume["projects"] }) {
  return (
    <Card title="Projects">
      <ul className="grid gap-3">
        {items.map((item, i) => (
          <li key={`${item.name}-${i}`} className="text-sm">
            <div className="font-medium">{item.name}</div>
            {item.description ? (
              <p className="text-muted-foreground">{item.description}</p>
            ) : null}
            {item.technologies.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {item.technologies.map((tech, ti) => (
                  <span
                    key={`${tech}-${ti}`}
                    className="rounded-md bg-muted px-2 py-0.5 text-xs"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ============================================================================
// Small bits
// ============================================================================

function ExternalLink({ href, label }: { href: string; label: string }) {
  // Some resumes list URLs without a scheme (e.g. "linkedin.com/in/x"). Prepend
  // https:// so the link actually works when clicked.
  const finalHref = /^https?:\/\//i.test(href) ? href : `https://${href}`;
  return (
    <a
      href={finalHref}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
    >
      {label}
      <ExternalLinkIcon className="size-3" />
    </a>
  );
}

function formatDateRange(
  start: string | null,
  end: string | null,
  isCurrent: boolean,
): string {
  if (!start && !end) return "";
  const endLabel = isCurrent ? "Present" : (end ?? "");
  if (start && endLabel) return `${start} – ${endLabel}`;
  return start ?? endLabel;
}

function formatDegree(
  degree: string | null,
  field: string | null,
): string {
  if (degree && field) return `${degree} ${field}`;
  return degree ?? field ?? "Studies";
}
