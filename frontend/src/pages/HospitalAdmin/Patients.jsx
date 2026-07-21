import React from "react";
import useHospitalPatients from "../../hooks/useHospitalPatients";

export default function Patients() {
  const {
    patients,
    nextCursor,
    hasMore,
    loadingMore,
    loading,
    query,
    setQuery,
    msg,
    familyAnchorEnabled,
    setFamilyAnchorEnabled,
    cacheReady,
    cacheBadge,
    form,
    setForm,
    guardianQuery,
    setGuardianQuery,
    guardianResults,
    guardianSearching,
    selectedGuardian,
    setSelectedGuardian,
    guardianRelationship,
    setGuardianRelationship,
    guardianNotes,
    setGuardianNotes,
    inviteNewGuardian,
    setInviteNewGuardian,
    newGuardian,
    setNewGuardian,
    parentAnchor,
    setParentAnchor,
    ocrBusy,
    ocrMsg,
    ocrPreview,
    familyApprovalBusy,
    familyApprovalMsg,
    familyApprovalOtp,
    setFamilyApprovalOtp,
    familyApprovalStatus,
    parentIdFileInputRef,
    parentIdCameraInputRef,
    isMinor,
    needsFamilyAnchor,
    fetchPatients,
    loadMore,
    create,
    applyScannedParentIdentity,
    runParentIdExtraction,
    requestFamilyOtp,
    verifyFamilyOtp,
    searchGuardians,
    resetView,
  } = useHospitalPatients();

  return (
    <div className="dashboard">
      <h3>Patients</h3>
      {msg && <p className="muted">{msg}</p>}
      <div className="grid" style={{ gridTemplateColumns: "minmax(280px, 360px) 1fr", gap: 12 }}>
        <div className="card form">
          <input
            placeholder="Search patient by name or national ID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="welcome-actions">
            <button type="button" className="btn-secondary" onClick={fetchPatients} disabled={loading}>
              {loading ? "Searching..." : "Search"}
            </button>
            <button type="button" className="btn-secondary" onClick={resetView} disabled={loading}>
              Reset View
            </button>
          </div>
          <span className="muted">{cacheBadge}</span>

          <input
            placeholder="First"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />
          <input
            placeholder="Last"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          />
          <input
            placeholder="National ID"
            value={form.nationalId}
            onChange={(e) => setForm({ ...form, nationalId: e.target.value })}
          />
          <input
            placeholder="DOB"
            type="date"
            value={form.dob}
            onChange={(e) => setForm({ ...form, dob: e.target.value })}
          />
          {!isMinor ? (
            <label className="profile-row" style={{ gap: 10, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={familyAnchorEnabled}
                onChange={(e) => setFamilyAnchorEnabled(e.target.checked)}
              />
              Register this patient under an approved family anchor ID
            </label>
          ) : null}
          {needsFamilyAnchor ? (
            <>
              <div className="subtle-banner">
                {isMinor
                  ? "This patient is a minor. Use any of the supported flows: link an existing parent account, create and invite a new parent, or register the child under the parent's national ID if only the ID card is available."
                  : "This patient will be attached to a family anchor so one approved national ID can serve the spouse and children under the same household record."}
              </div>
              <input
                placeholder="Search family anchor by name, email, phone, or national ID"
                value={guardianQuery}
                onChange={(e) => setGuardianQuery(e.target.value)}
              />
              <div className="welcome-actions">
                <button type="button" className="btn-secondary" onClick={searchGuardians} disabled={guardianSearching}>
                  {guardianSearching ? "Searching..." : "Find Family Anchor Account"}
                </button>
                {selectedGuardian ? (
                  <button type="button" className="btn-secondary" onClick={() => setSelectedGuardian(null)}>
                    Clear Parent
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setInviteNewGuardian((prev) => !prev);
                    if (selectedGuardian) setSelectedGuardian(null);
                  }}
                >
                  {inviteNewGuardian ? "Use Existing Account" : "Create & Invite Anchor"}
                </button>
              </div>
              <select value={guardianRelationship} onChange={(e) => setGuardianRelationship(e.target.value)}>
                <option value="PARENT">Parent / Father</option>
                <option value="GUARDIAN">Guardian</option>
                <option value="CAREGIVER">Caregiver</option>
                <option value="SPOUSE">Spouse</option>
                <option value="DEPENDENT">Dependent</option>
              </select>
              <input
                placeholder="Family anchor note (optional)"
                value={guardianNotes}
                onChange={(e) => setGuardianNotes(e.target.value)}
              />
              <div className="card form">
                <strong>Family national ID anchor</strong>
                <span className="muted">
                  If the father or primary family anchor does not yet have an AfyaLink account, staff can still register the family under that national ID. OTP approval sent to the anchor phone makes the linkage legally safer and reusable across spouse and children.
                </span>
                <div className="welcome-actions">
                  <button type="button" className="btn-secondary" onClick={() => parentIdFileInputRef.current?.click()} disabled={ocrBusy}>
                    {ocrBusy ? "Scanning..." : "Upload Parent ID"}
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => parentIdCameraInputRef.current?.click()} disabled={ocrBusy}>
                    {ocrBusy ? "Scanning..." : "Take Photo"}
                  </button>
                </div>
                <input
                  ref={parentIdFileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.bmp"
                  style={{ display: "none" }}
                  onChange={(e) => runParentIdExtraction(e.target.files?.[0] || null)}
                />
                <input
                  ref={parentIdCameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: "none" }}
                  onChange={(e) => runParentIdExtraction(e.target.files?.[0] || null)}
                />
                {ocrMsg ? <span className="muted">{ocrMsg}</span> : null}
                {ocrPreview ? (
                  <div className="card premium-card">
                    <strong>OCR preview</strong>
                    <div className="panel-grid" style={{ marginTop: 10 }}>
                      <div className="card">
                        <div className="profile-row" style={{ justifyContent: "space-between" }}>
                          <span>National ID</span>
                          <span className="action-pill">{ocrPreview.confidence?.nationalIdNumber || "LOW"}</span>
                        </div>
                        <div className="muted">{ocrPreview.preview?.nationalIdNumber || "Not detected"}</div>
                      </div>
                      <div className="card">
                        <div className="profile-row" style={{ justifyContent: "space-between" }}>
                          <span>Country</span>
                          <span className="action-pill">{ocrPreview.confidence?.nationalIdCountry || "LOW"}</span>
                        </div>
                        <div className="muted">{ocrPreview.preview?.nationalIdCountry || "Not detected"}</div>
                      </div>
                      <div className="card">
                        <div className="profile-row" style={{ justifyContent: "space-between" }}>
                          <span>Name</span>
                          <span className="action-pill">{ocrPreview.confidence?.displayName || "LOW"}</span>
                        </div>
                        <div className="muted">{ocrPreview.preview?.displayName || "Not detected"}</div>
                      </div>
                      <div className="card">
                        <div className="profile-row" style={{ justifyContent: "space-between" }}>
                          <span>Phone</span>
                          <span className="action-pill">{ocrPreview.confidence?.phone || "LOW"}</span>
                        </div>
                        <div className="muted">{ocrPreview.preview?.phone || "Not detected"}</div>
                      </div>
                    </div>
                    <div className="welcome-actions" style={{ marginTop: 10 }}>
                      <button type="button" className="btn-primary" onClick={() => applyScannedParentIdentity(ocrPreview)}>
                        Use Scanned Values
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => {}}>
                        Clear Preview
                      </button>
                    </div>
                    {ocrPreview.sourceSummary ? (
                      <p className="muted" style={{ marginTop: 8 }}>{ocrPreview.sourceSummary}</p>
                    ) : null}
                  </div>
                ) : null}
                <input
                  placeholder="Family anchor national ID"
                  value={parentAnchor.nationalIdNumber}
                  onChange={(e) => setParentAnchor((prev) => ({ ...prev, nationalIdNumber: e.target.value }))}
                />
                <input
                  placeholder="Family anchor ID country (e.g. KE)"
                  value={parentAnchor.nationalIdCountry}
                  onChange={(e) => setParentAnchor((prev) => ({ ...prev, nationalIdCountry: e.target.value.toUpperCase() }))}
                />
                <input
                  placeholder="Family anchor holder name (optional)"
                  value={parentAnchor.displayName}
                  onChange={(e) => setParentAnchor((prev) => ({ ...prev, displayName: e.target.value }))}
                />
                <input
                  placeholder="Family anchor phone for OTP approval"
                  value={parentAnchor.phone}
                  onChange={(e) => setParentAnchor((prev) => ({ ...prev, phone: e.target.value }))}
                />
                <div className="welcome-actions">
                  <button type="button" className="btn-secondary" onClick={requestFamilyOtp} disabled={familyApprovalBusy}>
                    {familyApprovalBusy ? "Sending..." : "Send Family OTP"}
                  </button>
                  <input
                    placeholder="Enter OTP"
                    value={familyApprovalOtp}
                    onChange={(e) => setFamilyApprovalOtp(e.target.value)}
                  />
                  <button type="button" className="btn-primary" onClick={verifyFamilyOtp} disabled={familyApprovalBusy}>
                    {familyApprovalBusy ? "Verifying..." : "Verify OTP"}
                  </button>
                </div>
                {familyApprovalStatus === "APPROVED" ? <div className="action-pill ok">Family anchor approved</div> : null}
                {familyApprovalMsg ? <span className="muted">{familyApprovalMsg}</span> : null}
              </div>
              {inviteNewGuardian ? (
                <div className="card form">
                  <strong>Create family anchor account and send invite</strong>
                  <input
                    placeholder="Anchor full name"
                    value={newGuardian.name}
                    onChange={(e) => setNewGuardian((prev) => ({ ...prev, name: e.target.value }))}
                  />
                  <input
                    placeholder="Anchor email"
                    value={newGuardian.email}
                    onChange={(e) => setNewGuardian((prev) => ({ ...prev, email: e.target.value }))}
                  />
                  <input
                    placeholder="Anchor phone"
                    value={newGuardian.phone}
                    onChange={(e) => setNewGuardian((prev) => ({ ...prev, phone: e.target.value }))}
                  />
                  <input
                    placeholder="Anchor national ID"
                    value={newGuardian.nationalIdNumber}
                    onChange={(e) => setNewGuardian((prev) => ({ ...prev, nationalIdNumber: e.target.value }))}
                  />
                  <input
                    placeholder="Anchor national ID country (e.g. KE)"
                    value={newGuardian.nationalIdCountry}
                    onChange={(e) => setNewGuardian((prev) => ({ ...prev, nationalIdCountry: e.target.value.toUpperCase() }))}
                  />
                  <span className="muted">A secure set-password email will be sent to the family anchor after the patient record is created.</span>
                </div>
              ) : null}
              {selectedGuardian ? (
                <div className="card">
                  <strong>Linked family anchor:</strong> {selectedGuardian.name}
                  <div className="muted">{selectedGuardian.email || selectedGuardian.phone || selectedGuardian.nationalIdNumber || "No contact"}</div>
                  {selectedGuardian.nationalIdNumber ? (
                    <div className="muted">Family anchor national ID: {selectedGuardian.nationalIdNumber}{selectedGuardian.nationalIdCountry ? ` (${selectedGuardian.nationalIdCountry})` : ""}</div>
                  ) : null}
                </div>
              ) : null}
              {guardianResults.length && !inviteNewGuardian ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Contact</th>
                        <th>Role</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {guardianResults.map((item) => (
                        <tr key={item._id}>
                          <td>{item.name}</td>
                          <td>{item.email || item.phone || item.nationalIdNumber || "-"}</td>
                          <td>{item.role}</td>
                          <td>
                            <button
                              type="button"
                              className={selectedGuardian?._id === item._id ? "btn-secondary" : "btn-primary"}
                              onClick={() => setSelectedGuardian(item)}
                            >
                              {selectedGuardian?._id === item._id ? "Selected" : "Use"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          ) : null}
          <div>
            <button type="button" className="btn-primary" onClick={create}>Create</button>
          </div>
        </div>
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>ID</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p._id}>
                    <td>{p.firstName} {p.lastName}</td>
                    <td>{p.nationalId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <button type="button" className="btn-secondary" onClick={loadMore} disabled={loadingMore} style={{ marginTop: 8 }}>
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
