import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui';

const PAGES = {
  about: {
    title: 'About NaicGo',
    body: (
      <>
        <p><strong>NaicGo</strong> is the output of the study <em>Development of a Web-Based Public Transportation Terminal Route Guide for Commuters in Naic, Cavite</em>. It centralizes information about public transportation terminals, documented routes, destinations, fares, driver-reported vehicle availability, and registered drivers in Naic.</p>
        <h2>Objectives</h2>
        <ul>
          <li>Provide accessible information on terminals, routes and fares.</li>
          <li>Help commuters discover which terminal, route and transportation type reaches their destination.</li>
          <li>Allow approved drivers to report vehicle availability and propose information updates.</li>
          <li>Offer map-based guidance with documented alternatives during verified road obstructions.</li>
          <li>Give registered commuters a private, accountable way to report driver-related problems.</li>
        </ul>
        <h2>Scope and limitations</h2>
        <p>NaicGo covers terminals and documented routes within Naic, Cavite for tricycles, jeepneys and buses. It does <strong>not</strong> provide real-time GPS vehicle tracking, live traffic monitoring, guaranteed arrival times, automatic road-closure detection, guaranteed vehicle counts, or unverified routes outside the municipality. All information comes from researcher-verified sources, approved transportation personnel, or clearly labelled demonstration records.</p>
      </>
    ),
  },
  contact: {
    title: 'Contact',
    body: (
      <>
        <p>For corrections to terminal, route or fare information, questions about a passenger report, or driver account concerns, please contact the NaicGo research team.</p>
        <p>Registered commuters can follow up on reports from <Link to="/commuter/reports">My Reports</Link>. Approved drivers can submit corrections through <Link to="/driver/update-requests">Update Requests</Link>.</p>
        <p className="rounded-xl bg-warning-50 p-3 text-sm">Researchers: replace this paragraph with the official contact email or office of the NaicGo project before evaluation.</p>
        <p>For emergencies, contact local authorities directly. NaicGo is not an emergency service.</p>
      </>
    ),
  },
  privacy: {
    title: 'Privacy Policy',
    body: (
      <>
        <p>NaicGo collects only the information needed to operate the service, in line with the principles of the Philippine Data Privacy Act of 2012 (RA 10173): transparency, legitimate purpose and proportionality.</p>
        <h2>What we collect</h2>
        <ul>
          <li><strong>Account data:</strong> name, username, email and (optionally) contact number. Passwords are stored only as one-way bcrypt hashes.</li>
          <li><strong>Driver data:</strong> transportation type, association/operator details and assignments, used for approval and record management.</li>
          <li><strong>Passenger reports:</strong> incident details and optional evidence files you upload.</li>
          <li><strong>Security logs:</strong> important administrative actions and sign-in events, without passwords or tokens.</li>
        </ul>
        <h2>How it is protected</h2>
        <ul>
          <li>Passenger reports and evidence are visible only to the commuter who filed them and to authorized administrators. They are never publicly searchable.</li>
          <li>A complainant&apos;s identity is not disclosed to drivers.</li>
          <li>Evidence files are stored outside public web folders and are served only to authorized users.</li>
          <li>Public pages never show private driver details such as phone numbers.</li>
        </ul>
        <h2>Your choices</h2>
        <p>You may update your profile at any time and may request correction or deletion of your account data through the research team.</p>
      </>
    ),
  },
  terms: {
    title: 'Terms of Use',
    body: (
      <>
        <ul>
          <li>NaicGo is an academic research system. Information is provided for guidance and may be incomplete or out of date. Confirm fares, routes and availability with transportation personnel.</li>
          <li>Vehicle availability is driver-reported and is not real-time tracking. Map road directions come from third-party services and may differ from actual public vehicle paths.</li>
          <li>Passenger reports must be truthful. Reports are treated as allegations until reviewed; submitting a report does not establish wrongdoing. False, duplicate or malicious reports may be rejected and the account suspended.</li>
          <li>Drivers must provide accurate information and may only report on vehicles assigned to them.</li>
          <li>Do not attempt to access other users&apos; data or restricted areas of the system.</li>
        </ul>
      </>
    ),
  },
};

export default function InfoPage({ page }) {
  const p = PAGES[page];
  return (
    <div className="container-page max-w-3xl py-10">
      <PageHeader title={p.title} />
      <div className="card space-y-4 p-6 text-sm leading-relaxed text-ink/85 sm:p-8 [&_a]:font-semibold [&_a]:text-brand [&_h2]:pt-2 [&_h2]:text-lg [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {p.body}
      </div>
    </div>
  );
}
