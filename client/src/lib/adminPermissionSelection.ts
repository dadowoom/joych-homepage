type AssignedPermissionSubject = {
  memberId: number;
  name: string;
};

/** 상단 권한 보유 계정을 하단 검색과 권한 편집 대상에 함께 연결합니다. */
export function buildAssignedPermissionSubjectSelection(subject: AssignedPermissionSubject) {
  const searchTerm = subject.name.trim();

  return {
    selectedMemberId: subject.memberId,
    searchInput: searchTerm,
    submittedSearchTerm: searchTerm,
  };
}
