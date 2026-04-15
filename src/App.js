import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@supabase/supabase-js";
import {
  SignInButton,
  UserButton,
  useSession,
  useUser
} from "@clerk/clerk-react";
import headphones from "./assets/headphones.png"; // ✅ NEU

/* =========================
   CONFIG
========================= */
const FLOWISE_BASE_URL = "https://flowise-production-86eb.up.railway.app/api/v1";
const CHATFLOW_ID = "77fe7e7c-0238-4f2b-a688-abc4e4e2c43c";
const FLOWISE_API_KEY = "";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY;

const GUEST_LOGIN_PROMPT_AFTER = 5;
const FREE_MESSAGE_LIMIT = 20;

/* =========================
   HEADER
========================= */
function Header({ isSignedIn }) {
  return (
    <header style={headerStyles.header}>
      <div style={headerStyles.container}>
        <h1 style={headerStyles.logo}>EDMAI</h1>

        {/* ✅ BILD NEBEN LOGO */}
        <img
          src={headphones}
          alt="Headphones"
          style={headerStyles.logoImage}
        />
      </div>

      <div style={headerStyles.userArea}>
        {isSignedIn ? (
          <UserButton
            appearance={{
              elements: {
                avatarBox: {
                  width: 36,
                  height: 36
                }
              }
            }}
          />
        ) : (
          <SignInButton mode="modal">
            <button style={headerStyles.loginButton}>Login</button>
          </SignInButton>
        )}
      </div>
    </header>
  );
}

const headerStyles = {
  header: {
    height: 90,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "#000",
    borderBottom: "1px solid #111",
    padding: "0 20px"
  },

  container: {
    display: "flex",
    alignItems: "center",
    gap: 12 // ✅ Abstand zwischen Text und Bild
  },

  logo: {
    margin: 0,
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: "1px"
  },

  logoImage: {
    height: 32, // ✅ gleiche Höhe
    width: "auto",
    objectFit: "contain"
  },

  userArea: {
    display: "flex",
    alignItems: "center"
  },

  loginButton: {
    padding: "10px 16px",
    borderRadius: 8,
    border: "1px solid #2a2a2a",
    background: "#fff",
    color: "#111827",
    cursor: "pointer",
    fontWeight: 600
  }
};

/* =========================
   FOOTER
========================= */
function Footer() {
  return (
    <footer style={footerStyles.footer}>
      <div style={footerStyles.links}>
        <a href="/imprint" style={footerStyles.link}>
          Imprint
        </a>

        <a href="/privacy" style={footerStyles.link}>
          Privacy
        </a>

        <a href="/legal" style={footerStyles.link}>
          Legal Policy
        </a>
      </div>
    </footer>
  );
}

const footerStyles = {
  footer: {
    height: 60,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#000",
    borderTop: "1px solid #111"
  },

  links: {
    display: "flex",
    gap: 25,
    justifyContent: "center",
    alignItems: "center"
  },

  link: {
    color: "#ffffff",
    textDecoration: "none",
    fontSize: 12,
    opacity: 1
  }
};