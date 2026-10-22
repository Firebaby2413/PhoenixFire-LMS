import { useState, useMemo, useEffect, useRef } from "react";
import { getDisplayName } from '../utils/academySettings';
import { latestThreadPreview, sortContactsByThread } from '../utils/messageInbox';

export default function Messages({
  currentUser = {},
  users = [],
  messages = [],
  notices = [],
  onOpenThread,
  onSendMessage
}) {
  const [selectedContact, setSelectedContact] = useState(null);
  const [msgText, setMsgText] = useState("");
  const [isContactsOpen, setIsContactsOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const threadRef = useRef(null);

  const isStaff =
    currentUser?.role?.toLowerCase() === "admin" ||
    currentUser?.role?.toLowerCase() === "mentor" ||
    currentUser?.role?.toLowerCase() === "ta";

  useEffect(() => {
    if (!selectedContact?.id) return;
    onOpenThread?.(selectedContact);
  }, [selectedContact, messages, onOpenThread]);

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    thread.scrollTo({ top: 0, behavior: 'smooth' });
  }, [messages, selectedContact]);

  const baseContacts = useMemo(() => {
    const list = Array.isArray(users) ? users : [];
    return list.filter((u) => u.email !== currentUser.email);
  }, [users, currentUser.email]);

  const filteredContacts = useMemo(() => {
    const matched = baseContacts.filter((c) => {
      const fullName = `${c.firstName || ""} ${c.lastName || ""}`.toLowerCase();
      const displayName = getDisplayName(c).toLowerCase();
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        fullName.includes(query) ||
        displayName.includes(query) ||
        c.email?.toLowerCase().includes(query);

      const matchesRole =
        roleFilter === "all" ? true : c.role?.toLowerCase() === roleFilter.toLowerCase();

      return matchesSearch && matchesRole;
    });
    return sortContactsByThread(matched, messages, currentUser);
  }, [baseContacts, searchQuery, roleFilter, messages, currentUser]);

  const messageBody = (message) => message.body || message.text || '';
  const messageTime = (message) => message.created_at || message.timestamp;
  const samePerson = (messageValue, person) =>
    messageValue === person?.id || messageValue === person?.email;

  const sendMessage = async () => {
    if (!msgText.trim() || !selectedContact?.id || !onSendMessage) return;
    try {
      await onSendMessage(selectedContact, msgText);
      setMsgText("");
    } catch (err) {
      alert(err.message || 'Could not send this message.');
    }
  };

  const incoming = useMemo(() => {
    return notices.filter((note) => note.senderId !== selectedContact?.id);
  }, [notices, selectedContact?.id]);

  const openContact = (person) => {
    setSelectedContact(person);
    onOpenThread?.(person);
  };

  const unreadFor = (person) => notices.find((note) => note.senderId === person.id);

  return (
    <div className="section-container" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
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
              <div className="messages-contact-list" style={{ flex: 1, overflowY: "auto", marginTop: "5px" }}>
                {filteredContacts.length === 0 && (
                  <p className="messages-empty-text" style={{ opacity: 0.7 }}>
                    No contacts available.
                  </p>
                )}

                {filteredContacts.map((c) => {
                  const unread = unreadFor(c);
                  const preview = latestThreadPreview(messages, currentUser, c);
                  return (
                  <button
                    key={c.id || c.email}
                    className={`course-box ${selectedContact?.email === c.email ? "active-msg" : ""}`}
                    onClick={() => openContact(c)}
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
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                      <div style={{ fontWeight: unread ? 700 : 600, fontSize: "0.9rem", color: "inherit", minWidth: 0 }}>
                        {getDisplayName(c)}
                      </div>
                      {unread && (
                        <span
                          aria-label={`${unread.count} unread`}
                          style={{
                            minWidth: "22px",
                            height: "22px",
                            padding: "0 6px",
                            borderRadius: "11px",
                            background: "#ff8c00",
                            color: "#111",
                            fontSize: "12px",
                            fontWeight: "bold",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0
                          }}
                        >
                          {unread.count}
                        </span>
                      )}
                    </div>
                    {preview && (
                      <div
                        style={{
                          fontSize: "12px",
                          marginTop: "4px",
                          opacity: unread ? 0.95 : 0.65,
                          fontWeight: unread ? 600 : 400,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                      >
                        {preview}
                      </div>
                    )}
                    <div style={{ fontSize: "11px", opacity: 0.7, textTransform: "uppercase", marginTop: "2px", color: "inherit" }}>
                      {c.role}
                    </div>
                  </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Main: Chat Window */}
        <div className="messages-chat-panel" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {incoming.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "10px" }}>
              {incoming.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => {
                    const person = users.find((u) => u.id === note.senderId);
                    if (person) openContact(person);
                  }}
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #10b981",
                    background: "rgba(16, 185, 129, 0.15)",
                    color: "inherit",
                    cursor: "pointer"
                  }}
                >
                  <strong>New message from {note.senderName}</strong>
                  {note.preview && (
                    <div style={{ fontSize: "0.85rem", marginTop: "4px", opacity: 0.85 }}>{note.preview}</div>
                  )}
                </button>
              ))}
            </div>
          )}
          {selectedContact ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
                  Chatting with {getDisplayName(selectedContact)}
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
                ref={threadRef}
                className="messages-thread"
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "15px",
                  background: "rgba(0,0,0,0.2)",
                  borderRadius: "12px",
                  border: "1px solid var(--pf-border, #334155)",
                  marginBottom: "15px"
                }}
              >
                {messages
                  .filter((m) => {
                    const mine = samePerson(m.sender_id, currentUser) || samePerson(m.sender, currentUser);
                    const fromThem = samePerson(m.sender_id, selectedContact) || samePerson(m.sender, selectedContact);
                    const toThem = samePerson(m.receiver_id, selectedContact) || samePerson(m.receiver, selectedContact);
                    const toMe = samePerson(m.receiver_id, currentUser) || samePerson(m.receiver, currentUser);
                    return (mine && toThem) || (fromThem && toMe);
                  })
                  .slice()
                  .reverse()
                  .map((m) => {
                    const mine = samePerson(m.sender_id, currentUser) || samePerson(m.sender, currentUser);
                    return (
                    <div
                      key={m.id}
                      style={{
                        textAlign: mine ? "right" : "left",
                        marginBottom: "12px"
                      }}
                    >
                      <div
                        style={{
                          display: "inline-block",
                          padding: "10px 14px",
                          borderRadius: "15px",
                          background: mine
                              ? "var(--magic-blue, #2563eb)"
                              : "#334155",
                          color: "#fff",
                          maxWidth: "85%",
                          wordBreak: "break-word",
                          fontSize: "0.95rem"
                        }}
                      >
                        {messageBody(m)}
                      </div>
                      <div style={{ fontSize: "10px", opacity: 0.6, marginTop: "4px" }}>
                        {new Date(messageTime(m)).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </div>
                    </div>
                    );
                  })}
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