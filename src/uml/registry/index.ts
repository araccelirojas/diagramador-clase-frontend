export {
  CLASSIFIERS,
  CLASSIFIER_LIST,
  compartmentIdsOf,
  getClassifier,
  hasClassifier,
} from '@/uml/registry/classifiers/index'

export { RELATIONS, RELATION_LIST, getRelation, hasRelation } from '@/uml/registry/relations/index'

export { MEMBERS, MEMBER_LIST } from '@/uml/registry/members'

export type {
  ClassifierRenderProps,
  ClassifierSpec,
  ClassifierVariant,
  CompartmentSpec,
  MarkerId,
  MemberSpec,
  RelationSpec,
  RelationSupports,
} from '@/uml/registry/types'
