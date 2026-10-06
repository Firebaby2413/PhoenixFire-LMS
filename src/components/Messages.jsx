import { useState, useMemo, useEffect } from "react";

const STORAGE_KEY = "phoenix_lms_messages";

export default function Messages({ currentUser = {}, users = [] }) {
  const [selectedContact, setSelectedContact] = useState(null);
  const [msgText, setMsgText] = useState("");
  const [isContactsOpen, setIsContactsOpen] = useState(true);
  const [localMessages, setLocalMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load messages from localStorage", e);
      return [];
    }
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const isStaff =
    currentUser?.role?.toLowerCase() === "admin" ||
    currentUser?.role?.toLowerCase() === "mentor" ||
    currentUser?.role?.toLowerCase() === "ta";

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(localMessages));
    } catch (e) {
      console.error("Failed to save messages to localStorage", e);
    }
  }, [localMessages]);

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          setLocalMessages(JSON.parse(e.newValue));
        } catch (err) {
          console.error("Error parsing cross-tab messages", err);
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const baseContacts = useMemo(() => {
    const list = Array.isArray(users) ? users : [];
    return list.filter((u) => u.email !== currentUser.email);
  }, [users, currentUser.email]);

  const filteredContacts = useMemo(() => {
    return baseContacts.filter((c) => {
      const fullName = `${c.firstName || ""} ${c.lastName || ""}`.toLowerCase();
      const matchesSearch =
        fullName.includes(searchQuery.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRole =
        roleFilter === "all" ? true : c.role?.toLowerCase() === roleFilter.toLowerCase();

      return matchesSearch && matchesRole;
    });
  }, [baseContacts, searchQuery, roleFilter]);

  const sendMessage = () => {
    if (!msgText.trim() || !selectedContact) return;
    const newMessage = {
      id: Date.now(),
      sender: currentUser.email,
      receiver: selectedContact.email,
      text: msgText,
      timestamp: new Date().toISOString()
    };
    setLocalMessages((prev) => [...prev, newMessage]);
    setMsgText("");
  };

  return (
    <div className="section-container" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Messaging Grid Container */}
      <div className="messaging-container" style={{ display: "flex", flex: 1, gap: "20px", minHeight: 0 }}>
        {/* Contacts Sidebar with Small Arrow Toggle */}
        <div
          className="messages-contacts-sidebar"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            width: isContactsOpen ? "280px" : "auto",
            flexShrink: 0,
            transition: "width 0.2s ease"
          }}
        >
          {/* Header Row with Compact Collapse Arrow */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={() => setIsContactsOpen(!isContactsOpen)}
              title={isContactsOpen ? "Collapse Contacts" : "Expand Contacts"}
              style={{
                background: "transparent",
                border: "none",
                color: "#ff8c00",
                cursor: "pointer",
                fontSize: "1rem",
                padding: "2px 4px",
                display: "flex",
                alignItems: "center"
              }}
            >
              {isContactsOpen ? "❮" : "❯"}
            </button>
            {isContactsOpen && (
              <h3 style={{ fontSize: "1.1rem", margin: 0, color: "var(--section-subheading-color, #10b981)" }}>
                Contacts
              </h3>
            )}
          </div>

          {isContactsOpen && (
            <>
              <input
                className="input-wide"
                type="text"
                placeholder="Search name or email..."
                aria-label="Search contacts by name or email"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ padding: "8px 10px", fontSize: "0.9rem", width: "100%", boxSizing: "border-box" }}
              />

              {/* Filter Pills */}
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                {["all", "student", "ta", "mentor", "admin"].map((role) => (
                  <button
                    key={role}
                    onClick={() => setRoleFilter(role)}
                    aria-pressed={roleFilter === role}
                    style={{
                      fontSize: "10px",
                      padding: "4px 8px",
                      minHeight: "28px",
                      borderRadius: "10px",
                      border: "1px solid var(--pf-border, #334155)",
                      background:
                        roleFilter === role
                          ? "var(--magic-blue, #2563eb)"
                          : "transparent",
                      color: "#fff",
                      cursor: "pointer",
                      textTransform: "uppercase"
                    }}
                  >
                    {role}
                  </button>
                ))}
              </div>

              {/* Contact Scroll Area */}
              <div style={{ flex: 1, overflowY: "auto", marginTop: "5px" }}>
                {filteredContacts.length === 0 && (
                  <p className="messages-empty-text" style={{ opacity: 0.7 }}>
                    No contacts available.
                  </p>
                )}

                {filteredContacts.map((c) => (
                  <button
                    key={c.id || c.email}
                    className={`course-box ${selectedContact?.email === c.email ? "active-msg" : ""}`}
                    onClick={() => setSelectedContact(c)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      cursor: "pointer",
                      padding: "10px",
                      marginBottom: "8px",
                      borderRadius: "8px",
                      border: "1px solid var(--pf-border, #334155)",
                      background: selectedContact?.email === c.email ? "rgba(37, 99, 235, 0.2)" : "transparent"
                    }}
                  >
                    <div style={{ fontWeight: "bold", fontSize: "0.9rem", color: "inherit" }}>
                      {c.firstName || c.lastName ? `${c.firstName || ''} ${c.lastName || ''}`.trim() : c.email}
                    </div>
                    <div style={{ fontSize: "11px", opacity: 0.7, textTransform: "uppercase", marginTop: "2px", color: "inherit" }}>
                      {c.role}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Main: Chat Window */}
        <div className="messages-chat-panel" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {selectedContact ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
                  Chatting with {selectedContact.firstName || selectedContact.email}
                </h3>
                {isStaff && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      background: "rgba(16, 185, 129, 0.2)",
                      color: "#10b981",
                      border: "1px solid #10b981"
                    }}
                  >
                    Staff View
                  </span>
                )}
              </div>

              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "15px",
                  background: "rgba(0,0,0,0.2)",
                  borderRadius: "12px",
                  border: "1px solid var(--pf-border, #334155)",
                  marginBottom: "15px",
                  minHeight: "200px"
                }}
              >
                {localMessages
                  .filter(
                    (m) =>
                      (m.sender === currentUser.email && m.receiver === selectedContact.email) ||
                      (m.sender === selectedContact.email && m.receiver === currentUser.email)
                  )
                  .map((m) => (
                    <div
                      key={m.id}
                      style={{
                        textAlign: m.sender === currentUser.email ? "right" : "left",
                        marginBottom: "12px"
                      }}
                    >
                      <div
                        style={{
                          display: "inline-block",
                          padding: "10px 14px",
                          borderRadius: "15px",
                          background:
                            m.sender === currentUser.email
                              ? "var(--magic-blue, #2563eb)"
                              : "#334155",
                          color: "#fff",
                          maxWidth: "85%",
                          wordBreak: "break-word",
                          fontSize: "0.95rem"
                        }}
                      >
                        {m.text}
                      </div>
                      <div style={{ fontSize: "10px", opacity: 0.6, marginTop: "4px" }}>
                        {new Date(m.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </div>
                    </div>
                  ))}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
                <textarea
                  className="input-wide"
                  value={msgText}
                  onChange={(e) => setMsgText(e.target.value)}
                  placeholder={`Write a message to ${selectedContact.firstName || selectedContact.email}...`}
                  aria-label={`Message text to ${selectedContact.firstName || selectedContact.email}`}
                  rows={3}
                  style={{
                    width: "100%",
                    resize: "vertical",
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                    padding: "10px",
                    fontSize: "1rem"
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button className="btn" onClick={sendMessage} style={{ width: "auto", minWidth: "140px", minHeight: "44px" }}>
                    Send Message
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.5 }}>
              <p>Select a contact from the panel on the left to view conversations.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}