"use client";

import { useEffect, useState } from "react";

export const DOCS_SECTIONS = [
  { id: "visao", label: "Visão geral" },
  { id: "stack", label: "Tecnologias" },
  { id: "arquitetura", label: "Arquitetura" },
  { id: "http", label: "Endpoints HTTP" },
  { id: "webhooks", label: "Webhooks" },
  { id: "actions", label: "Server Actions" },
  { id: "banco", label: "Banco de dados" },
  { id: "devops", label: "Azure DevOps" },
  { id: "acesso", label: "Acesso e papéis" },
  { id: "regras", label: "Regras de negócio" },
  { id: "ambiente", label: "Variáveis de ambiente" },
  { id: "deploy", label: "Rodar e publicar" },
];

// Table of contents that highlights the section being read.
export function DocsToc() {
  const [current, setCurrent] = useState(DOCS_SECTIONS[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setCurrent(entry.target.id);
        }
      },
      { rootMargin: "-10% 0px -75% 0px" }
    );
    for (const { id } of DOCS_SECTIONS) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <nav className="toc" aria-label="Seções">
      <p className="brand">Painel Relacional</p>
      <p className="sub">Documentação técnica</p>
      <ol>
        {DOCS_SECTIONS.map((section) => (
          <li key={section.id}>
            <a href={`#${section.id}`} className={current === section.id ? "on" : undefined}>
              {section.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
