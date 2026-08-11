import { useState, useMemo } from "react";

export default function Messages({ currentUser = {}, users = [] }) {
  const [selectedContact, setSelectedContact] = useState(null);
  const [msgText, setMsgText] = useState("");
  const [localMessages, setLocalMessages] = useState([]);

  const isStaff = currentUser.role === "admin" || currentUser.role === "mentor";

  // Filter list of people to talk to
  const contacts = useMemo(() => {
    const list = Array.isArray(users) ? users : [];
    if (isStaff) {
      // Mentors/Admins see students
      return list.filter((u) => u.role === "student");
    }
    // Students see Mentors/Admins
    return list.filter((u) => u.role === "mentor" || u.role === "admin");
  }, [users, isStaff]);

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
    <div
      className="section-container"
      style={{ display: "flex", height: "75vh", gap: "20px" }}
    >
      {/* Sidebar: Contacts */}
      <div
        style={{
          width: "30%",
          borderRight: "1px solid var(--pf-border)",
          paddingRight: "10px",
          overflowY: "auto"
        }}
      >
        <h3 className="pf-title" style={{ fontSize: "1.2rem" }}>
          Contacts
        </h3>
        {contacts.length === 0 && (
          <p className="help-text">No contacts available.</p>
        )}
        {contacts.map((c) => (
          <div
            key={c.id || c.email}
            className={`course-box ${
              selectedContact?.email === c.email ? "active-msg" : ""
            }`}
            onClick={() => setSelectedContact(c)}
            style={{
              cursor: "pointer",
              padding: "12px",
              marginBottom: "8px",
              border: "1px solid var(--pf-border)"
            }}
          >
            <div style={{ fontWeight: "bold" }}>
              {c.firstName} {c.lastName}
            </div>
            <div
              style={{
                fontSize: "10px",
                opacity: 0.7,
                textTransform: "uppercase"
              }}
            >
              {c.role}
            </div>
          </div>
        ))}
      </div>

      {/* Main: Chat Window */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {selectedContact ? (
          <>
            <h3 className="pf-title" style={{ marginBottom: "15px" }}>
              Chatting with {selectedContact.firstName}
            </h3>
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "15px",
                background: "rgba(0,0,0,0.2)",
                borderRadius: "12px",
                border: "1px solid var(--pf-border)"
              }}
            >
              {localMessages
                .filter(
                  (m) =>
                    (m.sender === currentUser.email &&
                      m.receiver === selectedContact.email) ||
                    (m.sender === selectedContact.email &&
                      m.receiver === currentUser.email)
                )
                .map((m) => (
                  <div
                    key={m.id}
                    style={{
                      textAlign:
                        m.sender === currentUser.email ? "right" : "left",
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
                            ? "var(--magic-blue)"
                            : "#334155",
                        color: "#fff"
                      }}
                    >
                      {m.text}
                    </div>
                    <div
                      style={{
                        fontSize: "10px",
                        opacity: 0.5,
                        marginTop: "4px"
                      }}
                    >
                      {new Date(m.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </div>
                  </div>
                ))}
            </div>
            <div
              style={{ marginTop: "15px", display: "flex", gap: "10px" }}
            >
              <input
                className="input-wide"
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
                placeholder="Type a message..."
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              />
              <button className="btn" onClick={sendMessage}>
                Send
              </button>
            </div>
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: 0.5
            }}
          >
            <p>Select a contact to start messaging.</p>
          </div>
        )}
      </div>
    </div>
  );
}