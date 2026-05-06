import "server-only";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

export function EmailLayout({
  preview,
  heading,
  children,
}: {
  preview: string;
  heading: string;
  children: ReactNode;
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={brand}>
            <Text style={brandText}>EduMeet</Text>
          </Section>
          <Section style={card}>
            <Heading as="h1" style={h1}>
              {heading}
            </Heading>
            {children}
          </Section>
          <Section style={footer}>
            <Text style={footerText}>
              EduMeet · You&apos;re receiving this because of activity on your
              EduMeet account.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body: React.CSSProperties = {
  backgroundColor: "#F4F6FA",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  margin: 0,
  padding: "32px 0",
};

const container: React.CSSProperties = {
  maxWidth: "560px",
  margin: "0 auto",
  padding: "0 16px",
};

const brand: React.CSSProperties = {
  textAlign: "center",
  paddingBottom: "16px",
};

const brandText: React.CSSProperties = {
  color: "#0F172A",
  fontSize: "18px",
  fontWeight: 700,
  letterSpacing: "-0.2px",
  margin: 0,
};

const card: React.CSSProperties = {
  backgroundColor: "#FFFFFF",
  border: "1px solid #E2E8F0",
  borderRadius: "12px",
  padding: "32px",
};

const h1: React.CSSProperties = {
  color: "#0F172A",
  fontSize: "20px",
  fontWeight: 700,
  margin: "0 0 16px 0",
};

const footer: React.CSSProperties = {
  paddingTop: "16px",
  textAlign: "center",
};

const footerText: React.CSSProperties = {
  color: "#64748B",
  fontSize: "11px",
  margin: 0,
};

/* shared inline styles re-exported so template files stay terse */

export const styles = {
  paragraph: {
    color: "#334155",
    fontSize: "14px",
    lineHeight: "22px",
    margin: "0 0 12px 0",
  } as React.CSSProperties,
  noteBlock: {
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: "8px",
    padding: "12px 14px",
    margin: "8px 0 16px 0",
  } as React.CSSProperties,
  noteLabel: {
    color: "#64748B",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.5px",
    margin: "0 0 4px 0",
    textTransform: "uppercase" as const,
  } as React.CSSProperties,
  noteText: {
    color: "#0F172A",
    fontSize: "14px",
    lineHeight: "20px",
    margin: 0,
    whiteSpace: "pre-wrap" as const,
  } as React.CSSProperties,
  buttonWrap: {
    margin: "20px 0 4px 0",
  } as React.CSSProperties,
  button: {
    backgroundColor: "#2563EB",
    borderRadius: "8px",
    color: "#FFFFFF",
    display: "inline-block",
    fontSize: "14px",
    fontWeight: 600,
    padding: "10px 18px",
    textDecoration: "none",
  } as React.CSSProperties,
  hint: {
    color: "#64748B",
    fontSize: "12px",
    lineHeight: "18px",
    margin: "16px 0 0 0",
  } as React.CSSProperties,
};
