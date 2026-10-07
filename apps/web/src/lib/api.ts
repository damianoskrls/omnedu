import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    const headers = config.headers as { delete?: (name: string) => void } | undefined;
    headers?.delete?.('Content-Type');
    headers?.delete?.('content-type');
  }
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res.data?.data ?? res.data,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const { data } = await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
            { refreshToken },
          );
          localStorage.setItem('access_token', data.data.accessToken);
          error.config.headers.Authorization = `Bearer ${data.data.accessToken}`;
          return axios(error.config);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error.response?.data ?? error);
  },
);

export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  logout: (refreshToken: string) => api.post('/auth/logout', { refreshToken }),
  switchContext: (schoolId: string, role: string) =>
    api.post('/auth/switch-context', { schoolId, role }),
};

export const schoolsApi = {
  list: () => api.get('/schools'),
  get: (id: string) => api.get(`/schools/${id}`),
  create: (data: any) => api.post('/schools', data),
  update: (id: string, data: any) => api.patch(`/schools/${id}`, data),
  getMembers: (id: string, role?: string) =>
    api.get(`/schools/${id}/members`, { params: { role } }),
  updateBranding: (id: string, data: { name?: string; logoUrl?: string; primaryColor?: string }) =>
    api.patch(`/schools/${id}`, data),
  getRegulations: (id: string, academicYear?: string) =>
    api.get(`/schools/${id}/regulations`, { params: academicYear ? { academicYear } : {} }),
  saveRegulations: (id: string, data: { academicYear: string; operatingRegulation?: string | null; financialRegulation?: string | null }) =>
    api.put(`/schools/${id}/regulations`, data),
  getHolidays: (id: string, academicYear?: string) =>
    api.get(`/schools/${id}/holidays`, { params: academicYear ? { academicYear } : {} }),
  createHoliday: (id: string, data: { date: string; name: string; academicYear?: string }) =>
    api.post(`/schools/${id}/holidays`, data),
  deleteHoliday: (id: string, holidayId: string) =>
    api.delete(`/schools/${id}/holidays/${holidayId}`),
  uploadLogo: (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/schools/${id}/logo`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

export const studentsApi = {
  list: (schoolId: string, classId?: string, isActive?: boolean) =>
    api.get(`/schools/${schoolId}/students`, { params: { classId, ...(isActive !== undefined ? { isActive: String(isActive) } : {}) } }),
  get: (schoolId: string, id: string) => api.get(`/schools/${schoolId}/students/${id}`),
  create: (schoolId: string, data: any) => api.post(`/schools/${schoolId}/students`, data),
  update: (schoolId: string, id: string, data: any) =>
    api.patch(`/schools/${schoolId}/students/${id}`, data),
  permanentDelete: (schoolId: string, id: string) =>
    api.delete(`/schools/${schoolId}/students/${id}`),
  uploadAvatar: (schoolId: string, id: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/schools/${schoolId}/students/${id}/avatar`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  enroll: (schoolId: string, id: string, classId: string) =>
    api.post(`/schools/${schoolId}/students/${id}/enroll`, { classId }),
  getDocuments: (schoolId: string, id: string, academicYear?: string) =>
    api.get(`/schools/${schoolId}/students/${id}/documents`, { params: academicYear ? { academicYear } : {} }),
  uploadDocument: (schoolId: string, id: string, file: File, meta: { title?: string; category?: string; notes?: string; academicYear?: string }) => {
    const fd = new FormData();
    fd.append('file', file);
    if (meta.title) fd.append('title', meta.title);
    if (meta.category) fd.append('category', meta.category);
    if (meta.notes) fd.append('notes', meta.notes);
    if (meta.academicYear) fd.append('academicYear', meta.academicYear);
    return api.post(`/schools/${schoolId}/students/${id}/documents`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deleteDocument: (schoolId: string, id: string, docId: string) =>
    api.delete(`/schools/${schoolId}/students/${id}/documents/${docId}`),
  getSiblings: (schoolId: string, id: string) =>
    api.get(`/schools/${schoolId}/students/${id}/siblings`),
  linkSibling: (schoolId: string, id: string, siblingId: string) =>
    api.post(`/schools/${schoolId}/students/${id}/siblings`, { siblingId }),
  unlinkSibling: (schoolId: string, id: string, siblingId: string) =>
    api.delete(`/schools/${schoolId}/students/${id}/siblings/${siblingId}`),
  addParent: (schoolId: string, id: string, data: { fullName: string; email?: string; phone?: string; relation?: string; isPrimary?: boolean }) =>
    api.post(`/schools/${schoolId}/students/${id}/parents`, data),
  updateParent: (schoolId: string, id: string, parentUserId: string, data: { fullName?: string; phone?: string; relation?: string; isPrimary?: boolean }) =>
    api.patch(`/schools/${schoolId}/students/${id}/parents/${parentUserId}`, data),
  removeParent: (schoolId: string, id: string, parentUserId: string) =>
    api.delete(`/schools/${schoolId}/students/${id}/parents/${parentUserId}`),
};

export const classesApi = {
  list: (schoolId: string) => api.get(`/schools/${schoolId}/classes`),
  get: (schoolId: string, id: string) => api.get(`/schools/${schoolId}/classes/${id}`),
  create: (schoolId: string, data: { name: string; academicYearId: string; levelId?: string; ageGroup?: string; capacity?: number }) =>
    api.post(`/schools/${schoolId}/classes`, data),
  academicYears: (schoolId: string) =>
    api.get(`/schools/${schoolId}/classes/academic-years/list`),
  createInstruction: (schoolId: string, classId: string, data: { title: string; content: string; category?: string }) =>
    api.post(`/schools/${schoolId}/classes/${classId}/instructions`, data),
  updateInstruction: (schoolId: string, classId: string, instructionId: string, data: { title?: string; content?: string; category?: string }) =>
    api.put(`/schools/${schoolId}/classes/${classId}/instructions/${instructionId}`, data),
  deleteInstruction: (schoolId: string, classId: string, instructionId: string) =>
    api.delete(`/schools/${schoolId}/classes/${classId}/instructions/${instructionId}`),
};

export const reportsApi = {
  feed: (schoolId: string) => api.get(`/schools/${schoolId}/daily-reports/feed`),
  byStudent: (schoolId: string, studentId: string) =>
    api.get(`/schools/${schoolId}/daily-reports/student/${studentId}`),
  upsert: (schoolId: string, data: any) => api.post(`/schools/${schoolId}/daily-reports`, data),
};

export const billingApi = {
  myInvoices: (schoolId: string) => api.get(`/schools/${schoolId}/billing/invoices/mine`),
  allInvoices: (schoolId: string) => api.get(`/schools/${schoolId}/billing/invoices`),
  stats: (schoolId: string) => api.get(`/schools/${schoolId}/billing/stats`),
  create: (schoolId: string, data: any) => api.post(`/schools/${schoolId}/billing/invoices`, data),
  // Level fees
  getLevelFees: (schoolId: string) => api.get(`/schools/${schoolId}/billing/level-fees`),
  upsertLevelFee: (schoolId: string, levelId: string, data: any) =>
    api.put(`/schools/${schoolId}/billing/level-fees/${levelId}`, data),
  deleteLevelFee: (schoolId: string, feeId: string) =>
    api.delete(`/schools/${schoolId}/billing/level-fees/${feeId}`),
  // Student fee overrides
  getStudentFee: (schoolId: string, studentId: string) =>
    api.get(`/schools/${schoolId}/billing/students/${studentId}/fee`),
  upsertStudentFee: (schoolId: string, studentId: string, data: any) =>
    api.put(`/schools/${schoolId}/billing/students/${studentId}/fee`, data),
  deleteStudentFee: (schoolId: string, studentId: string) =>
    api.delete(`/schools/${schoolId}/billing/students/${studentId}/fee`),
  // Subsidies
  getSubsidies: (schoolId: string, studentId: string) =>
    api.get(`/schools/${schoolId}/billing/students/${studentId}/subsidies`),
  createSubsidy: (schoolId: string, studentId: string, data: any) =>
    api.post(`/schools/${schoolId}/billing/students/${studentId}/subsidies`, data),
  updateSubsidy: (schoolId: string, studentId: string, subsidyId: string, data: any) =>
    api.patch(`/schools/${schoolId}/billing/students/${studentId}/subsidies/${subsidyId}`, data),
  deleteSubsidy: (schoolId: string, studentId: string, subsidyId: string) =>
    api.delete(`/schools/${schoolId}/billing/students/${studentId}/subsidies/${subsidyId}`),
  // Monthly charges
  getCharges: (schoolId: string, month: number, year: number) =>
    api.get(`/schools/${schoolId}/billing/charges`, { params: { month, year } }),
  getStudentCharges: (schoolId: string, studentId: string) =>
    api.get(`/schools/${schoolId}/billing/charges/student/${studentId}`),
  getStudentStatement: (schoolId: string, studentId: string) =>
    api.get(`/schools/${schoolId}/billing/students/${studentId}/statement`),
  generateCharges: (schoolId: string, month: number, year: number) =>
    api.post(`/schools/${schoolId}/billing/charges/generate`, { month, year }),
  generateStudentCharge: (schoolId: string, studentId: string, month: number, year: number) =>
    api.post(`/schools/${schoolId}/billing/students/${studentId}/charges/generate`, { month, year }),
  updateCharge: (schoolId: string, chargeId: string, data: any) =>
    api.patch(`/schools/${schoolId}/billing/charges/${chargeId}`, data),
  deleteCharge: (schoolId: string, chargeId: string) =>
    api.delete(`/schools/${schoolId}/billing/charges/${chargeId}`),
  // One-time charges
  getOneTimeCharges: (schoolId: string, params?: { studentId?: string; status?: string }) =>
    api.get(`/schools/${schoolId}/billing/one-time`, { params }),
  createOneTimeCharge: (schoolId: string, data: any) =>
    api.post(`/schools/${schoolId}/billing/one-time`, data),
  updateOneTimeCharge: (schoolId: string, chargeId: string, data: any) =>
    api.patch(`/schools/${schoolId}/billing/one-time/${chargeId}`, data),
  deleteOneTimeCharge: (schoolId: string, chargeId: string) =>
    api.delete(`/schools/${schoolId}/billing/one-time/${chargeId}`),
  generateAnnualCharges: (schoolId: string, year: number) =>
    api.post(`/schools/${schoolId}/billing/one-time/generate-annual`, { year }),
};

export const levelsApi = {
  list: (schoolId: string) => api.get(`/schools/${schoolId}/levels`),
  get: (schoolId: string, id: string) => api.get(`/schools/${schoolId}/levels/${id}`),
  create: (schoolId: string, data: any) => api.post(`/schools/${schoolId}/levels`, data),
  update: (schoolId: string, id: string, data: any) =>
    api.patch(`/schools/${schoolId}/levels/${id}`, data),
  remove: (schoolId: string, id: string) => api.delete(`/schools/${schoolId}/levels/${id}`),
};

export const thematicPlansApi = {
  list: (schoolId: string, params?: { month?: string; classId?: string }) =>
    api.get(`/schools/${schoolId}/thematic-plans`, { params }),
  save: (schoolId: string, data: any) => api.post(`/schools/${schoolId}/thematic-plans`, data),
  remove: (schoolId: string, id: string) => api.delete(`/schools/${schoolId}/thematic-plans/${id}`),
};

export const parentMeetingsApi = {
  list: (schoolId: string, params?: { classId?: string; levelId?: string }) =>
    api.get(`/schools/${schoolId}/parent-meetings`, { params }),
  create: (schoolId: string, data: any) =>
    api.post(`/schools/${schoolId}/parent-meetings`, data),
  update: (schoolId: string, id: string, data: any) =>
    api.patch(`/schools/${schoolId}/parent-meetings/${id}`, data),
  remove: (schoolId: string, id: string) =>
    api.delete(`/schools/${schoolId}/parent-meetings/${id}`),
};

export const dailyMenusApi = {
  list: (schoolId: string, params?: { from?: string; to?: string; audienceType?: string; audienceIds?: string }) =>
    api.get(`/schools/${schoolId}/daily-menus`, { params }),
  upsert: (schoolId: string, data: any) => api.post(`/schools/${schoolId}/daily-menus`, data),
  bulk: (schoolId: string, data: any) => api.post(`/schools/${schoolId}/daily-menus/bulk`, data),
  copyMonth: (schoolId: string, data: { from: string; to: string; audienceType?: string; audienceIds?: string[] }) =>
    api.post(`/schools/${schoolId}/daily-menus/copy-month`, data),
  importFile: (schoolId: string, file: File, month?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (month) form.append('month', month);
    return api.post(`/schools/${schoolId}/daily-menus/import`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  remove: (schoolId: string, id: string) =>
    api.delete(`/schools/${schoolId}/daily-menus/${id}`),
};

export const questionnairesApi = {
  list: (schoolId: string, academicYear?: number) =>
    api.get(`/schools/${schoolId}/questionnaires`, { params: academicYear ? { academicYear } : {} }),
  forStudent: (schoolId: string, studentId: string) =>
    api.get(`/schools/${schoolId}/questionnaires/for-student/${studentId}`),
  get: (schoolId: string, id: string) =>
    api.get(`/schools/${schoolId}/questionnaires/${id}`),
  create: (schoolId: string, data: any) =>
    api.post(`/schools/${schoolId}/questionnaires`, data),
  update: (schoolId: string, id: string, data: any) =>
    api.patch(`/schools/${schoolId}/questionnaires/${id}`, data),
  remove: (schoolId: string, id: string) =>
    api.delete(`/schools/${schoolId}/questionnaires/${id}`),
  getResponses: (schoolId: string, id: string) =>
    api.get(`/schools/${schoolId}/questionnaires/${id}/responses`),
  upsertResponse: (schoolId: string, id: string, studentId: string, answers: Record<string, any>) =>
    api.post(`/schools/${schoolId}/questionnaires/${id}/responses`, { studentId, answers }),
};

export const studentFormsApi = {
  list: (schoolId: string, academicYear?: number) =>
    api.get(`/schools/${schoolId}/student-forms`, { params: { academicYear } }),
  get: (schoolId: string, studentId: string, year: number) =>
    api.get(`/schools/${schoolId}/student-forms/${studentId}/${year}`),
  upsert: (schoolId: string, studentId: string, year: number, data: any) =>
    api.post(`/schools/${schoolId}/student-forms/${studentId}/${year}`, data),
};

export const medicationRequestsApi = {
  list: (schoolId: string, params?: { studentId?: string; status?: string }) =>
    api.get(`/schools/${schoolId}/medication-requests`, { params }),
  get: (schoolId: string, id: string) =>
    api.get(`/schools/${schoolId}/medication-requests/${id}`),
  create: (schoolId: string, data: any) =>
    api.post(`/schools/${schoolId}/medication-requests`, data),
  acknowledge: (schoolId: string, id: string) =>
    api.patch(`/schools/${schoolId}/medication-requests/${id}/acknowledge`, {}),
  updateStatus: (schoolId: string, id: string, status: string) =>
    api.patch(`/schools/${schoolId}/medication-requests/${id}/status`, { status }),
  remove: (schoolId: string, id: string) =>
    api.delete(`/schools/${schoolId}/medication-requests/${id}`),
};

export const menuTemplatesApi = {
  list: (schoolId: string) => api.get(`/schools/${schoolId}/menu-templates`),
  get: (schoolId: string, id: string) => api.get(`/schools/${schoolId}/menu-templates/${id}`),
  create: (schoolId: string, data: any) => api.post(`/schools/${schoolId}/menu-templates`, data),
  update: (schoolId: string, id: string, data: any) => api.patch(`/schools/${schoolId}/menu-templates/${id}`, data),
  remove: (schoolId: string, id: string) => api.delete(`/schools/${schoolId}/menu-templates/${id}`),
  apply: (schoolId: string, id: string, month: string, audience?: { audienceType: string; audienceIds: string[] }) =>
    api.post(`/schools/${schoolId}/menu-templates/${id}/apply`, { month, ...audience }),
  fromMonth: (schoolId: string, data: { month: string; name?: string; audienceType?: string; audienceIds?: string[] }) =>
    api.post(`/schools/${schoolId}/menu-templates/from-month`, data),
  ensureSeptember: (schoolId: string, audience?: { audienceType: string; audienceIds: string[] }) =>
    api.post(`/schools/${schoolId}/menu-templates/presets/september-2026`, audience ?? {}),
};

export const broadcastsApi = {
  list: (schoolId: string) => api.get(`/schools/${schoolId}/notifications`),
  send: (schoolId: string, data: {
    title: string;
    body: string;
    imageUrl?: string;
    targetType: string;
    targetClassId?: string;
    targetStudentId?: string;
    channels?: string[];
  }) => api.post(`/schools/${schoolId}/notifications/send`, data),
  getSettings: (schoolId: string) => api.get(`/schools/${schoolId}/notifications/settings`),
  updateSettings: (schoolId: string, data: any) =>
    api.patch(`/schools/${schoolId}/notifications/settings`, data),
};

export const activitiesApi = {
  list: (schoolId: string, type?: string) =>
    api.get(`/schools/${schoolId}/activities`, { params: type ? { type } : {} }),
  get: (schoolId: string, id: string) => api.get(`/schools/${schoolId}/activities/${id}`),
  create: (schoolId: string, data: any) => api.post(`/schools/${schoolId}/activities`, data),
  update: (schoolId: string, id: string, data: any) =>
    api.patch(`/schools/${schoolId}/activities/${id}`, data),
  uploadImage: (schoolId: string, id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/schools/${schoolId}/activities/${id}/image`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  remove: (schoolId: string, id: string) => api.delete(`/schools/${schoolId}/activities/${id}`),
  getRegistrations: (schoolId: string, id: string) =>
    api.get(`/schools/${schoolId}/activities/${id}/registrations`),
  updateRegistrationStatus: (schoolId: string, id: string, regId: string, status: string) =>
    api.patch(`/schools/${schoolId}/activities/${id}/registrations/${regId}/status`, { status }),
  adminEnroll: (schoolId: string, id: string, data: { studentId: string; notes?: string }) =>
    api.post(`/schools/${schoolId}/activities/${id}/enroll`, data),
  removeRegistration: (schoolId: string, id: string, regId: string) =>
    api.delete(`/schools/${schoolId}/activities/${id}/registrations/${regId}`),
  getSchedule: (schoolId: string) =>
    api.get(`/schools/${schoolId}/activities/schedule/all`),
  addScheduleSlot: (schoolId: string, activityId: string, data: { dayOfWeek: number; startTime?: string; endTime?: string; notes?: string }) =>
    api.post(`/schools/${schoolId}/activities/${activityId}/schedule`, data),
  deleteScheduleSlot: (schoolId: string, activityId: string, slotId: string) =>
    api.delete(`/schools/${schoolId}/activities/${activityId}/schedule/${slotId}`),
  getInstructors: (schoolId: string) =>
    api.get(`/schools/${schoolId}/activities/instructors/all`),
  createInstructor: (schoolId: string, data: { name: string; title?: string; bio?: string; photoUrl?: string }) =>
    api.post(`/schools/${schoolId}/activities/instructors/create`, data),
  updateInstructor: (schoolId: string, instructorId: string, data: any) =>
    api.patch(`/schools/${schoolId}/activities/instructors/${instructorId}`, data),
  deleteInstructor: (schoolId: string, instructorId: string) =>
    api.delete(`/schools/${schoolId}/activities/instructors/${instructorId}`),
  uploadInstructorPhoto: (schoolId: string, instructorId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/schools/${schoolId}/activities/instructors/${instructorId}/photo`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  assignInstructor: (schoolId: string, activityId: string, instructorId: string) =>
    api.post(`/schools/${schoolId}/activities/${activityId}/instructors/${instructorId}`, {}),
  unassignInstructor: (schoolId: string, activityId: string, instructorId: string) =>
    api.delete(`/schools/${schoolId}/activities/${activityId}/instructors/${instructorId}`),
};

export const extraServicesApi = {
  list: (schoolId: string) => api.get(`/schools/${schoolId}/extra-services`),
  get: (schoolId: string, id: string) => api.get(`/schools/${schoolId}/extra-services/${id}`),
  create: (schoolId: string, data: any) => api.post(`/schools/${schoolId}/extra-services`, data),
  update: (schoolId: string, id: string, data: any) =>
    api.patch(`/schools/${schoolId}/extra-services/${id}`, data),
  remove: (schoolId: string, id: string) =>
    api.delete(`/schools/${schoolId}/extra-services/${id}`),
  addRoute: (schoolId: string, id: string, data: any) =>
    api.post(`/schools/${schoolId}/extra-services/${id}/routes`, data),
  updateRoute: (schoolId: string, id: string, routeId: string, data: any) =>
    api.patch(`/schools/${schoolId}/extra-services/${id}/routes/${routeId}`, data),
  removeRoute: (schoolId: string, id: string, routeId: string) =>
    api.delete(`/schools/${schoolId}/extra-services/${id}/routes/${routeId}`),
  addStop: (schoolId: string, id: string, routeId: string, data: any) =>
    api.post(`/schools/${schoolId}/extra-services/${id}/routes/${routeId}/stops`, data),
  updateStop: (schoolId: string, id: string, routeId: string, stopId: string, data: any) =>
    api.patch(`/schools/${schoolId}/extra-services/${id}/routes/${routeId}/stops/${stopId}`, data),
  removeStop: (schoolId: string, id: string, routeId: string, stopId: string) =>
    api.delete(`/schools/${schoolId}/extra-services/${id}/routes/${routeId}/stops/${stopId}`),
  getStudents: (schoolId: string, id: string) =>
    api.get(`/schools/${schoolId}/extra-services/${id}/students`),
  assignStudent: (schoolId: string, id: string, data: any) =>
    api.post(`/schools/${schoolId}/extra-services/${id}/students`, data),
  updateStudentService: (schoolId: string, id: string, ssId: string, data: any) =>
    api.patch(`/schools/${schoolId}/extra-services/${id}/students/${ssId}`, data),
  removeStudentService: (schoolId: string, id: string, ssId: string) =>
    api.delete(`/schools/${schoolId}/extra-services/${id}/students/${ssId}`),
};

export const staffApi = {
  list: (schoolId: string) => api.get(`/schools/${schoolId}/staff`),
  get: (schoolId: string, memberId: string) => api.get(`/schools/${schoolId}/staff/${memberId}`),
  updateProfile: (schoolId: string, memberId: string, data: any) =>
    api.patch(`/schools/${schoolId}/staff/${memberId}/profile`, data),
  uploadAvatar: (schoolId: string, memberId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/schools/${schoolId}/staff/${memberId}/avatar`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getSalary: (schoolId: string, memberId: string) =>
    api.get(`/schools/${schoolId}/staff/${memberId}/salary`),
  createSalary: (schoolId: string, memberId: string, data: any) =>
    api.post(`/schools/${schoolId}/staff/${memberId}/salary`, data),
  getLeaves: (schoolId: string, memberId: string) =>
    api.get(`/schools/${schoolId}/staff/${memberId}/leaves`),
  createLeave: (schoolId: string, memberId: string, data: any) =>
    api.post(`/schools/${schoolId}/staff/${memberId}/leaves`, data),
  updateLeave: (schoolId: string, memberId: string, leaveId: string, status: string) =>
    api.patch(`/schools/${schoolId}/staff/${memberId}/leaves/${leaveId}`, { status }),
};

export const celebrationsApi = {
  list: (schoolId: string, academicYear?: string) =>
    api.get(`/schools/${schoolId}/celebrations`, { params: academicYear ? { academicYear } : {} }),
  create: (schoolId: string, data: any) => api.post(`/schools/${schoolId}/celebrations`, data),
  update: (schoolId: string, id: string, data: any) => api.patch(`/schools/${schoolId}/celebrations/${id}`, data),
  uploadImage: (schoolId: string, id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/schools/${schoolId}/celebrations/${id}/image`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  remove: (schoolId: string, id: string) => api.delete(`/schools/${schoolId}/celebrations/${id}`),
};

export const schoolEventsApi = {
  list: (schoolId: string, status?: string) =>
    api.get(`/schools/${schoolId}/events`, { params: status ? { status } : {} }),
  get: (schoolId: string, eventId: string) => api.get(`/schools/${schoolId}/events/${eventId}`),
  create: (schoolId: string, data: any) => api.post(`/schools/${schoolId}/events`, data),
  update: (schoolId: string, eventId: string, data: any) => api.put(`/schools/${schoolId}/events/${eventId}`, data),
  remove: (schoolId: string, eventId: string) => api.delete(`/schools/${schoolId}/events/${eventId}`),
  getEnrollments: (schoolId: string, eventId: string) => api.get(`/schools/${schoolId}/events/${eventId}/enrollments`),
  markPayment: (schoolId: string, eventId: string, enrollmentId: string, paid: boolean, extra?: { paidAt?: string; notes?: string }) =>
    api.put(`/schools/${schoolId}/events/${eventId}/enrollments/${enrollmentId}/payment`, { paid, ...extra }),
  uploadMedia: (schoolId: string, eventId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/schools/${schoolId}/events/${eventId}/media`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  removeMedia: (schoolId: string, eventId: string, mediaId: string) =>
    api.delete(`/schools/${schoolId}/events/${eventId}/media/${mediaId}`),
  adminUpdateEnrollment: (schoolId: string, eventId: string, enrollmentId: string, status: string) =>
    api.put(`/schools/${schoolId}/events/${eventId}/enrollments/${enrollmentId}/admin-status`, { status }),
};

export const schoolPostsApi = {
  list: (schoolId: string, type?: string) =>
    api.get(`/schools/${schoolId}/posts`, { params: type ? { type } : {} }),
  create: (schoolId: string, data: any) => api.post(`/schools/${schoolId}/posts`, data),
  update: (schoolId: string, id: string, data: any) => api.put(`/schools/${schoolId}/posts/${id}`, data),
  remove: (schoolId: string, id: string) => api.delete(`/schools/${schoolId}/posts/${id}`),
  uploadMedia: (schoolId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/schools/${schoolId}/posts/media`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
